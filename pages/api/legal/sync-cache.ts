import type { NextApiRequest, NextApiResponse } from 'next';
import { protectedHandler } from '~/lib/api/protected-handler';
import {
  syncRecentProjects,
  syncProjectsByYears,
  getCacheStats,
} from '~/lib/legal/project-cache-sync';

type SyncResponse = {
  success: boolean
  message: string
  stats?: {
    total: number
    inserted: number
    updated: number
    cacheTotal?: number
    cacheActive?: number
    lastSync?: string | null
  }
  errors?: string[]
} | {
  error: string
  details?: string
};

export default protectedHandler(async (
  req: NextApiRequest,
  res: NextApiResponse<SyncResponse>,
) => {
  // GET: Return cache stats
  if (req.method === 'GET') {
    try {
      const stats = await getCacheStats();

      if (stats.error) {
        return res.status(500).json({
          error: 'Error al conectar con la base de datos',
          details: stats.error,
        });
      }

      // lastSync might be a Date object or a string from the DB
      let lastSyncStr: string | null = null;
      if (stats.lastSync) {
        lastSyncStr = stats.lastSync instanceof Date
          ? stats.lastSync.toISOString()
          : String(stats.lastSync);
      }

      return res.status(200).json({
        success: true,
        message: 'Cache stats retrieved',
        stats: {
          total: stats.total,
          inserted: 0,
          updated: 0,
          cacheTotal: stats.total,
          cacheActive: stats.active,
          lastSync: lastSyncStr,
        },
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error getting cache stats:', errMsg);
      return res.status(500).json({
        error: 'Error al obtener estadísticas',
        details: errMsg,
      });
    }
  }

  // Only POST allowed for sync
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mode, startYear, endYear } = req.body as {
    mode?: 'recent' | 'bulk'
    startYear?: number
    endYear?: number
  };

  try {
    let result;

    if (mode === 'bulk' && startYear && endYear) {
      result = await syncProjectsByYears(startYear, endYear);
    } else {
      result = await syncRecentProjects();
    }

    const stats = await getCacheStats();

    // Check if there were errors
    if (result.errors && result.errors.length > 0 && result.total === 0) {
      return res.status(500).json({
        error: 'Sincronización falló',
        details: result.errors.join('; '),
      });
    }

    // lastSync might be a Date object or a string from the DB
    let lastSyncStr: string | null = null;
    if (stats.lastSync) {
      lastSyncStr = stats.lastSync instanceof Date
        ? stats.lastSync.toISOString()
        : String(stats.lastSync);
    }

    return res.status(200).json({
      success: true,
      message: `Sincronización completada: ${result.inserted} nuevos, ${result.updated} actualizados`,
      stats: {
        total: result.total,
        inserted: result.inserted,
        updated: result.updated,
        cacheTotal: stats.total,
        cacheActive: stats.active,
        lastSync: lastSyncStr,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Sync error:', errMsg);
    return res.status(500).json({
      error: 'Error durante la sincronización',
      details: errMsg,
    });
  }
}, { rateLimit: { limit: 5, windowMs: 10 * 60_000 } });
