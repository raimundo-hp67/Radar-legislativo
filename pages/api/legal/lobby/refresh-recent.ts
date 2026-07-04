import type { NextApiRequest, NextApiResponse } from 'next';
import { protectedHandler } from '~/lib/api/protected-handler';
import { db } from '~/db';
import { lobbyAudiencias } from '~/db/schema';
import { fetchAndPrepareAudiencias } from '~/lib/legal/infolobby-service';
import { radarConfig } from '~/config/radar.config';

// Institutions/topics to refresh come from the theme config (config/radar.config.ts)
const REFRESH_TARGETS = radarConfig.lobbySearchTargets.map((t) => ({
  boletin: t.code,
  title: t.query,
}));

export default protectedHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let totalInserted = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  for (const target of REFRESH_TARGETS) {
    try {
      const audiencias = await fetchAndPrepareAudiencias(target.boletin, target.title);

      for (const audiencia of audiencias) {
        try {
          await db.insert(lobbyAudiencias).values(audiencia).onConflictDoNothing();
          totalInserted++;
        } catch {
          totalSkipped++;
        }
      }
    } catch (err) {
      errors.push(`${target.boletin}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return res.status(200).json({
    ok: true,
    totalInserted,
    totalSkipped,
    errors,
    targetsChecked: REFRESH_TARGETS.length,
  });
}, { rateLimit: { limit: 5, windowMs: 10 * 60_000 } });
