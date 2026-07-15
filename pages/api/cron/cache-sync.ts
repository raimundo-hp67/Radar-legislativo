import type { NextApiRequest, NextApiResponse } from 'next';
import { syncRecentProjects, syncNewBoletines, getCacheStats } from '~/lib/legal/project-cache-sync';
import { rejectUnauthorizedCron } from '~/lib/api/cron-auth';

// Vercel: refrescar el catálogo de boletines contra el Senado toma minutos.
export const maxDuration = 300;

/**
 * Cron que mantiene FRESCO el catálogo de proyectos de ley (project_cache):
 * el buscador con el que los usuarios encuentran boletines y los suman a su
 * lista. Sincroniza el conjunto reciente de boletines (acotado para caber en
 * el límite de tiempo serverless). La carga histórica completa se hace una vez
 * con `scripts/bulk-sync.ts`; este cron solo va agregando/actualizando lo nuevo.
 *
 * Protegido por CRON_SECRET (fail-closed) igual que los demás crons.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (rejectUnauthorizedCron(req, res)) return;

  console.log('[cache-sync] Cron triggered at', new Date().toISOString());

  try {
    const result = await syncRecentProjects();
    // Además del refresco de semillas, descubrir los boletines que entraron
    // al Congreso después del último conocido (así el buscador crece solo).
    const discovered = await syncNewBoletines();
    const stats = await getCacheStats();

    const inserted = result.inserted + discovered.inserted;
    const updated = result.updated + discovered.updated;
    console.log(
      `[cache-sync] Listo — ${inserted} nuevos, ${updated} actualizados; catálogo total: ${stats.total}`,
    );

    return res.status(200).json({
      status: 'ok',
      inserted,
      updated,
      cacheTotal: stats.total,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[cache-sync] Cron error:', error);
    return res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}
