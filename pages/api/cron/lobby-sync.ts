import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '~/db';
import { lobbyAudiencias } from '~/db/schema';
import { gte } from 'drizzle-orm';
import { syncLobby } from '~/lib/legal/infolobby-service';
import { notifyLobbyActividad } from '~/lib/legal/slack-notifier';
import { rejectUnauthorizedCron } from '~/lib/api/cron-auth';

// Vercel: syncing months of audiencias against external APIs can take minutes
export const maxDuration = 300;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // Verify the request is from Vercel Cron (fail closed if CRON_SECRET is missing)
  if (rejectUnauthorizedCron(req, res)) return;

  console.log('[lobby-sync] Cron triggered at', new Date().toISOString());

  try {
    const syncResult = await syncLobby({ months: 2, verbose: true });

    console.log(
      `[lobby-sync] Sync complete — inserted: ${syncResult.inserted}, skipped: ${syncResult.skipped}, errors: ${syncResult.errors}`,
    );

    // Fetch recently inserted rows (last 7 days) to check for key institutions
    if (syncResult.inserted > 0) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentAudiencias = await db
        .select()
        .from(lobbyAudiencias)
        .where(gte(lobbyAudiencias.fetchedAt, sevenDaysAgo))
        .limit(200);

      try {
        await notifyLobbyActividad(recentAudiencias);
      } catch (slackError) {
        console.warn('[lobby-sync] Slack notification failed:', slackError instanceof Error ? slackError.message : String(slackError));
      }
    }

    return res.status(200).json({
      status: 'ok',
      inserted: syncResult.inserted,
      skipped: syncResult.skipped,
      errors: syncResult.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[lobby-sync] Cron error:', error);
    return res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}
