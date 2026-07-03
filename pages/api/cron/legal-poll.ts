import type { NextApiRequest, NextApiResponse } from 'next';
import { desc, eq } from 'drizzle-orm';
import { db } from '~/db';
import { legalProjects, projectSnapshots } from '~/db/schema';
import { fetchProjectStatus } from '~/lib/legal/congress-scraper';
import { diffSnapshots, hasSignificantChanges } from '~/lib/legal/diff-engine';
import { sendWeeklyDigest, sendSlackAlert } from '~/lib/legal/slack-notifier';
import { env } from '~/config/env';
import type { PollResult, PollSummary, Relevance } from '~/lib/legal/types';

/**
 * Cron endpoint for Vercel - called automatically every Monday at 09:00 Chile time
 * Protected by Vercel's CRON_SECRET header verification
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests (Vercel Cron uses GET)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify the request is from Vercel Cron
  // In production, Vercel automatically adds the Authorization header with CRON_SECRET
  const authHeader = req.headers.authorization;
  if (process.env.NODE_ENV === 'production') {
    if (!authHeader || authHeader !== `Bearer ${env.CRON_SECRET}`) {
      console.error('Unauthorized cron request');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  console.log('Starting legal poll cron job...');

  try {
    const summary = await runPoll();
    console.log(`Poll completed: ${summary.polled}/${summary.total} projects, ${summary.withChanges} with changes`);
    return res.status(200).json(summary);
  } catch (error) {
    console.error('Poll failed:', error);
    return res.status(500).json({
      error: 'Poll failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function runPoll(): Promise<PollSummary> {
  // Get all projects to poll
  const projects = await db.select().from(legalProjects);

  const results: PollResult[] = [];
  const errors: string[] = [];
  const highPriorityChanges: PollResult[] = [];

  for (const project of projects) {
    try {
      console.log(`Polling ${project.boletin}...`);

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

      if (changes.length > 0) {
        console.log(`Changes detected for ${project.boletin}: ${changes.length} field(s) changed`);
      }

      // Track high priority changes for immediate alerts
      if (
        changes.length > 0
        && project.relevance === 'HIGH'
        && hasSignificantChanges(changes)
      ) {
        highPriorityChanges.push(result);
      }

      // Add delay between requests to be respectful to the API
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
        console.log(`Sent Slack alert for HIGH priority: ${result.boletin}`);
      } catch (error) {
        console.error('Failed to send Slack alert:', error);
      }
    }

    // Send weekly digest with legislative changes
    try {
      await sendWeeklyDigest(resultsWithChanges);
      console.log('Sent Slack weekly digest');
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
