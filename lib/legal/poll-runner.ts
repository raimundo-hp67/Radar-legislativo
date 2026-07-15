import { desc, eq, max } from 'drizzle-orm';
import { db } from '~/db';
import { legalProjects, projectSnapshots } from '~/db/schema';
import { fetchProjectStatus } from '~/lib/legal/congress-scraper';
import { fetchRecentChangesFromSenado } from '~/lib/legal/senado-xml-parser';
import { diffSnapshots, hasSignificantChanges } from '~/lib/legal/diff-engine';
import { sendWeeklyDigest, sendSlackAlert } from '~/lib/legal/slack-notifier';
import { env } from '~/config/env';
import type { PollResult, PollSummary, Relevance } from '~/lib/legal/types';

export interface RunPollOptions {
  /**
   * 'always': send the Slack digest even when nothing changed (weekly cron).
   * 'changes-only': only alert/digest when there are actual changes, so
   * frequent runs (auto-updater) don't spam the channel.
   */
  digestMode?: 'always' | 'changes-only'
}

/**
 * Get the date of the last poll (most recent snapshot fetch)
 */
export async function getLastPollDate(): Promise<Date | null> {
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

/**
 * Poll the Senado API for every tracked project, snapshot the results,
 * detect changes and send Slack notifications. Shared by the manual
 * /api/legal/poll endpoint and the built-in auto-updater.
 */
export async function runPoll(options: RunPollOptions = {}): Promise<PollSummary> {
  const digestMode = options.digestMode ?? 'always';

  // Los snapshots son datos públicos compartidos por boletín, así que aunque
  // varios usuarios sigan el mismo proyecto lo scrapeamos UNA sola vez.
  // Deduplicamos por boletín quedándonos con la relevancia más alta entre
  // quienes lo siguen (para no perder alertas de proyectos marcados HIGH).
  const allProjects = await db.select().from(legalProjects);
  const rank: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  const byBoletin = new Map<string, (typeof allProjects)[number]>();
  for (const p of allProjects) {
    const cur = byBoletin.get(p.boletin);
    if (!cur || (rank[p.relevance] ?? 0) > (rank[cur.relevance] ?? 0)) {
      byBoletin.set(p.boletin, p);
    }
  }
  const projects = [...byBoletin.values()];
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

      // Sincronizar los campos visibles de TODOS los proyectos que siguen
      // este boletín (de cualquier usuario: el dato scrapeado es compartido).
      // Sin esto, la columna Estado queda congelada con el valor de creación.
      await db
        .update(legalProjects)
        .set({
          ...(scrapedData.stage
            ? { estado: scrapedData.stage.charAt(0).toUpperCase() + scrapedData.stage.slice(1) }
            : {}),
          ...(scrapedData.chamberCurrent
            ? { camara: scrapedData.chamberCurrent.includes('Diputados') ? 'Diputados' : 'Senado' }
            : {}),
          ...(scrapedData.urgency ? { urgencia: scrapedData.urgency } : {}),
          ...(scrapedData.commission ? { comision: scrapedData.commission } : {}),
          updatedAt: new Date(),
        })
        .where(eq(legalProjects.boletin, project.boletin));

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

    // Send the digest (skipped on quiet runs in 'changes-only' mode)
    if (digestMode === 'always' || resultsWithChanges.length > 0) {
      try {
        await sendWeeklyDigest(resultsWithChanges);
      } catch (error) {
        console.error('Failed to send Slack digest:', error);
      }
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
