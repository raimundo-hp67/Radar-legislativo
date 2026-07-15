import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '~/db';
import { lobbyAudiencias } from '~/db/schema';
import { sql, count, max } from 'drizzle-orm';
import { protectedHandler } from '~/lib/api/protected-handler';
import { syncLobby } from '~/lib/legal/infolobby-service';

interface StatsResponse {
  status: 'ok' | 'error'
  stats: {
    total: number
    lastSync: string | null
    recentCount: number
  }
  error?: string
}

interface SyncPostResponse {
  status: 'ok' | 'error'
  inserted: number
  skipped: number
  errors: number
  fetched?: number
  error?: string
}

type SyncResponse = StatsResponse | SyncPostResponse;

export default protectedHandler(async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SyncResponse>,
) {
  if (req.method === 'GET') {
    try {
      const [totalResult] = await db
        .select({ count: count() })
        .from(lobbyAudiencias);

      const [lastSyncResult] = await db
        .select({ lastSync: max(lobbyAudiencias.fetchedAt) })
        .from(lobbyAudiencias);

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0];

      const [recentResult] = await db
        .select({ count: count() })
        .from(lobbyAudiencias)
        .where(sql`${lobbyAudiencias.fecha} >= ${oneWeekAgoStr}`);

      const lastSync = lastSyncResult?.lastSync;

      return res.status(200).json({
        status: 'ok',
        stats: {
          total: totalResult?.count || 0,
          lastSync: lastSync instanceof Date ? lastSync.toISOString() : String(lastSync || ''),
          recentCount: recentResult?.count || 0,
        },
      });
    } catch (error) {
      console.error('Error getting lobby stats:', error);
      return res.status(500).json({
        status: 'error',
        stats: { total: 0, lastSync: null, recentCount: 0 },
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  if (req.method === 'POST') {
    try {
      const result = await syncLobby({ months: 6, verbose: false });
      return res.status(200).json({
        status: 'ok',
        inserted: result.inserted,
        skipped: result.skipped,
        errors: result.errors,
        fetched: result.fetched,
      });
    } catch (error) {
      console.error('Error syncing lobby:', error);
      return res.status(500).json({
        status: 'error',
        inserted: 0,
        skipped: 0,
        errors: 1,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return res.status(405).json({
    status: 'error',
    stats: { total: 0, lastSync: null, recentCount: 0 },
    error: 'Method not allowed',
  });
}, { rateLimit: { limit: 5, windowMs: 10 * 60_000 } });
