import type { NextApiRequest, NextApiResponse } from 'next';
import { protectedHandler } from '~/lib/api/protected-handler';
import { db } from '~/db';
import { lobbyAudiencias } from '~/db/schema';
import { fetchAndPrepareAudiencias } from '~/lib/legal/infolobby-service';

// Key institutions and topics to refresh
const REFRESH_TARGETS = [
  { boletin: 'CMF', title: 'Comisión para el Mercado Financiero fintech pagos emisoras no bancarias' },
  { boletin: 'BCCH', title: 'Banco Central de Chile medios de pago sistema de pagos' },
  { boletin: 'HACIENDA', title: 'Ministerio de Hacienda fintech servicios financieros digitales' },
  { boletin: 'UAF', title: 'Unidad de Análisis Financiero lavado de activos fintech' },
  { boletin: 'FINTEC', title: 'fintech medios de pago emisores no bancarios pagos digitales' },
];

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
});
