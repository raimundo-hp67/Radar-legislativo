import type { NextApiRequest, NextApiResponse } from 'next';
import { desc, eq, max } from 'drizzle-orm';
import { db } from '~/db';
import { legalProjects, projectSnapshots } from '~/db/schema';
import { fetchProjectStatus } from '~/lib/legal/congress-scraper';
import { fetchRecentChangesFromSenado } from '~/lib/legal/senado-xml-parser';
import { diffSnapshots, hasSignificantChanges } from '~/lib/legal/diff-engine';
import { sendSlackDigest, sendSlackAlert } from '~/lib/legal/slack-notifier';
import { env } from '~/config/env';
import { safeEqual } from '~/lib/api/cron-auth';
import { applyRateLimit, getClientIp } from '~/lib/api/rate-limit';
import type { PollResult, PollSummary, Relevance } from '~/lib/legal/types';

const DEFAULT_POLL_API_KEY = 'change-me-in-production';

/**
 * Manual poll endpoint - callable via curl or an external cron.
 * Protected by API key in x-api-key header.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Throttle before touching auth: this endpoint triggers heavy scraping.
  if (applyRateLimit(req, res, `ip:${getClientIp(req)}:poll`, { limit: 6, windowMs: 60 * 60_000 })) {
    return;
  }

  // In production, refuse to run with the well-known default key (fail closed).
  if (process.env.NODE_ENV === 'production' && env.LEGAL_POLL_API_KEY === DEFAULT_POLL_API_KEY) {
    console.error('LEGAL_POLL_API_KEY still has its default value — rejecting poll request');
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // Validate API key (constant-time comparison)
  const apiKey = req.headers['x-api-key'];
  if (typeof apiKey !== 'string' || !safeEqual(apiKey, env.LEGAL_POLL_API_KEY)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  try {
    const summary = await runPoll();
    return res.status(200).json(summary);
  } catch (error) {
    console.error('Poll failed:', error);
    return res.status(500).json({
      error: 'Poll failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get the date of the last poll (most recent snapshot fetch)
 */
async function getLastPollDate(): Promise<Date | null> {
  const result = await db
    .select({ maxDate: max(projectSnapshots.fetchedAt) })
    .from(projectSnapshots);

  return result[0]?.maxDate || null;
}

/**
 * Format date as DD/MM/YYYY for Senado API
 */
function formatDateForSenado(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

async function runPoll(): Promise<PollSummary> {
  // Get all projects to poll
  const projects = await db.select().from(legalProjects);
  const projectMap = new Map(projects.map((p) => [p.boletin.split('-')[0], p]));

  const results: PollResult[] = [];
  const errors: string[] = [];
  const highPriorityChanges: PollResult[] = [];

  // Get last poll date to optimize with date-based endpoint
  const lastPollDate = await getLastPollDate();
  let projectsToUpdate = new Set<string>();

  // Try to use the optimized date-based endpoint first
  if (lastPollDate) {
    // Don't go back more than 7 days (API limit is 1 month)
    const daysSinceLastPoll = Math.floor((Date.now() - lastPollDate.getTime()) / (1000 * 60 * 60 * 24));
    const sinceDate = daysSinceLastPoll <= 30
      ? lastPollDate
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    console.log(`Checking for changes since ${sinceDate.toISOString()}`);

    try {
      const recentChanges = await fetchRecentChangesFromSenado(formatDateForSenado(sinceDate));
      console.log(`Senado API returned ${recentChanges.length} projects with recent changes`);

      // Find which of our tracked projects have changes
      for (const senadoProject of recentChanges) {
        const boletinNumber = senadoProject.boletin.split('-')[0];
        if (projectMap.has(boletinNumber)) {
          projectsToUpdate.add(projectMap.get(boletinNumber)!.boletin);
        }
      }

      console.log(`${projectsToUpdate.size} tracked projects have changes`);
    } catch (error) {
      console.warn('Failed to fetch recent changes from Senado API, falling back to full poll:', error);
      // Fall back to polling all projects
      projectsToUpdate = new Set(projects.map((p) => p.boletin));
    }
  } else {
    // No previous poll, update all projects
    projectsToUpdate = new Set(projects.map((p) => p.boletin));
  }

  // Also poll HIGH priority projects regardless (they're important)
  for (const project of projects) {
    if (project.relevance === 'HIGH') {
      projectsToUpdate.add(project.boletin);
    }
  }

  console.log(`Polling ${projectsToUpdate.size} of ${projects.length} projects`);

  // Process projects that need updating
  for (const project of projects) {
    if (!projectsToUpdate.has(project.boletin)) {
      continue;
    }

    try {
      // Fetch current status from Congress
      const scrapedData = await fetchProjectStatus(project.boletin);

      // Get the previous snapshot
      const [previousSnapshot] = await db
        .select()
        .from(projectSnapshots)
        .where(eq(projectSnapshots.boletin, project.boletin))
        .orderBy(desc(projectSnapshots.fetchedAt))
        .limit(1);

      // Calculate diff
      const changes = diffSnapshots(previousSnapshot || null, scrapedData);

      // Save new snapshot
      const [newSnapshot] = await db
        .insert(projectSnapshots)
        .values({
          boletin: project.boletin,
          stage: scrapedData.stage,
          chamberCurrent: scrapedData.chamberCurrent,
          lastAction: scrapedData.lastAction,
          lastActionDate: scrapedData.lastActionDate,
          urgency: scrapedData.urgency,
          commission: scrapedData.commission,
          sourceProvider: 'senado_xml',
          sourceUrl: scrapedData.sourceUrl,
          changesDetected: changes.length > 0 ? changes : null,
        })
        .returning();

      const result: PollResult = {
        boletin: project.boletin,
        title: project.title,
        relevance: project.relevance as Relevance,
        snapshot: newSnapshot,
        changes: changes.length > 0 ? changes : null,
      };

      results.push(result);

      // Track high priority changes for immediate alerts
      if (
        changes.length > 0
        && project.relevance === 'HIGH'
        && hasSignificantChanges(changes)
      ) {
        highPriorityChanges.push(result);
      }

      // Add delay between requests
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      const errorMsg = `Error polling ${project.boletin}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
  }

  const resultsWithChanges = results.filter((r) => r.changes && r.changes.length > 0);

  // Send Slack notifications
  if (env.SLACK_WEBHOOK_URL) {
    // Send immediate alerts for high priority changes
    for (const result of highPriorityChanges) {
      try {
        await sendSlackAlert(result);
      } catch (error) {
        console.error('Failed to send Slack alert:', error);
      }
    }

    // Send weekly digest
    try {
      await sendSlackDigest(resultsWithChanges);
    } catch (error) {
      console.error('Failed to send Slack digest:', error);
    }
  }

  return {
    total: projects.length,
    polled: results.length,
    withChanges: resultsWithChanges.length,
    errors,
    results,
  };
}
