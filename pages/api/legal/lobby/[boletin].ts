import type { NextApiRequest, NextApiResponse } from 'next';
import { desc, ilike } from 'drizzle-orm';
import { db } from '~/db';
import { lobbyAudiencias } from '~/db/schema';
import { protectedHandler } from '~/lib/api/protected-handler';

type LobbyResponse = {
  boletin: string
  audiencias: Array<{
    id: number
    fecha: string | null
    sujetoPasivo: string | null
    sujetoPasivoInstitucion: string | null
    sujetoActivo: string | null
    sujetoActivoTipo: string | null
    tipoAudiencia: string | null
    lugar: string | null
    materia: string | null
    forma: string | null
    sourceUrl: string | null
  }>
  lastFetched: string | null
};

type ErrorResponse = {
  error: string
};

export default protectedHandler(async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LobbyResponse | ErrorResponse>,
) {
  const { boletin } = req.query;

  if (typeof boletin !== 'string') {
    return res.status(400).json({ error: 'Boletín inválido' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const audiencias = await db
      .select()
      .from(lobbyAudiencias)
      .where(ilike(lobbyAudiencias.searchText, `%${boletin}%`))
      .orderBy(desc(lobbyAudiencias.fecha))
      .limit(50);

    const lastFetched = audiencias.length > 0
      ? audiencias[0].fetchedAt.toISOString()
      : null;

    return res.status(200).json({
      boletin,
      audiencias: audiencias.map((a) => ({
        id: a.id,
        fecha: a.fecha,
        sujetoPasivo: a.sujetoPasivo,
        sujetoPasivoInstitucion: a.sujetoPasivoInstitucion,
        sujetoActivo: a.sujetoActivo,
        sujetoActivoTipo: a.sujetoActivoTipo,
        tipoAudiencia: a.tipoAudiencia,
        lugar: a.lugar,
        materia: a.materia,
        forma: a.forma,
        sourceUrl: a.sourceUrl,
      })),
      lastFetched,
    });
  } catch (error) {
    console.error('[LOBBY] Error fetching lobby data:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: `Error al obtener datos de lobby: ${errorMessage}` });
  }
});
