import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '~/db';
import { lobbyAudiencias } from '~/db/schema';
import { sql, desc } from 'drizzle-orm';
import { protectedHandler } from '~/lib/api/protected-handler';

interface RecentResponse {
  audiencias: {
    id: number
    infolobbyId: string
    fecha: string | null
    sujetoPasivo: string | null
    sujetoPasivoInstitucion: string | null
    sujetoActivo: string | null
    sujetoActivoOrganizacion: string | null
    materia: string | null
    sourceUrl: string | null
  }[]
  total: number
  error?: string
}

export default protectedHandler(async (
  req: NextApiRequest,
  res: NextApiResponse<RecentResponse>,
) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ audiencias: [], total: 0, error: 'Method not allowed' });
  }

  const { days = '7', limit = '10' } = req.query;
  const daysNum = parseInt(days as string, 10) || 7;
  const limitNum = Math.min(parseInt(limit as string, 10) || 10, 50);

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysNum);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const audiencias = await db
      .select({
        id: lobbyAudiencias.id,
        infolobbyId: lobbyAudiencias.infolobbyId,
        fecha: lobbyAudiencias.fecha,
        sujetoPasivo: lobbyAudiencias.sujetoPasivo,
        sujetoPasivoInstitucion: lobbyAudiencias.sujetoPasivoInstitucion,
        sujetoActivo: lobbyAudiencias.sujetoActivo,
        sujetoActivoOrganizacion: lobbyAudiencias.sujetoActivoOrganizacion,
        materia: lobbyAudiencias.materia,
        sourceUrl: lobbyAudiencias.sourceUrl,
      })
      .from(lobbyAudiencias)
      .where(sql`${lobbyAudiencias.fecha} >= ${cutoffStr}`)
      .orderBy(desc(lobbyAudiencias.fecha))
      .limit(limitNum);

    return res.status(200).json({
      audiencias,
      total: audiencias.length,
    });
  } catch (error) {
    console.error('Error getting recent lobby audiencias:', error);
    return res.status(500).json({
      audiencias: [],
      total: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
