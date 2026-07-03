import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '~/db';
import { lobbyAudiencias } from '~/db/schema';
import { desc, or, ilike, and, gte, lte, count } from 'drizzle-orm';
import { protectedHandler } from '~/lib/api/protected-handler';

interface SearchResponse {
  audiencias: {
    id: number
    infolobbyId: string
    fecha: string | null
    lugar: string | null
    forma: string | null
    tipoAudiencia: string | null
    sujetoPasivo: string | null
    sujetoPasivoCargo: string | null
    sujetoPasivoInstitucion: string | null
    sujetoActivo: string | null
    sujetoActivoTipo: string | null
    sujetoActivoOrganizacion: string | null
    materia: string | null
    observaciones: string | null
    sourceUrl: string | null
  }[]
  total: number
  totalCount: number
  error?: string
}

export default protectedHandler(async (
  req: NextApiRequest,
  res: NextApiResponse<SearchResponse>,
) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ audiencias: [], total: 0, totalCount: 0, error: 'Method not allowed' });
  }

  const {
    q,
    limit = '20',
    offset = '0',
    institution,
    cargo,
    dateFrom,
    dateTo,
  } = req.query;

  const limitNum = Math.min(parseInt(limit as string, 10) || 20, 100);
  const offsetNum = parseInt(offset as string, 10) || 0;

  try {
    const conditions = [];

    if (q && typeof q === 'string' && q.trim()) {
      const searchTerm = `%${q.trim().toLowerCase()}%`;
      conditions.push(
        or(
          ilike(lobbyAudiencias.searchText, searchTerm),
          ilike(lobbyAudiencias.materia, searchTerm),
          ilike(lobbyAudiencias.sujetoPasivo, searchTerm),
          ilike(lobbyAudiencias.sujetoActivo, searchTerm),
          ilike(lobbyAudiencias.sujetoPasivoInstitucion, searchTerm),
        ),
      );
    }

    if (institution && typeof institution === 'string' && institution.trim()) {
      conditions.push(ilike(lobbyAudiencias.sujetoPasivoInstitucion, `%${institution.trim()}%`));
    }

    if (cargo && typeof cargo === 'string' && cargo.trim()) {
      conditions.push(ilike(lobbyAudiencias.sujetoPasivoCargo, `%${cargo.trim()}%`));
    }

    if (dateFrom && typeof dateFrom === 'string') {
      conditions.push(gte(lobbyAudiencias.fecha, dateFrom));
    }

    if (dateTo && typeof dateTo === 'string') {
      conditions.push(lte(lobbyAudiencias.fecha, dateTo));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ value: count() })
      .from(lobbyAudiencias)
      .where(whereClause);

    const audiencias = await db
      .select({
        id: lobbyAudiencias.id,
        infolobbyId: lobbyAudiencias.infolobbyId,
        fecha: lobbyAudiencias.fecha,
        lugar: lobbyAudiencias.lugar,
        forma: lobbyAudiencias.forma,
        tipoAudiencia: lobbyAudiencias.tipoAudiencia,
        sujetoPasivo: lobbyAudiencias.sujetoPasivo,
        sujetoPasivoCargo: lobbyAudiencias.sujetoPasivoCargo,
        sujetoPasivoInstitucion: lobbyAudiencias.sujetoPasivoInstitucion,
        sujetoActivo: lobbyAudiencias.sujetoActivo,
        sujetoActivoTipo: lobbyAudiencias.sujetoActivoTipo,
        sujetoActivoOrganizacion: lobbyAudiencias.sujetoActivoOrganizacion,
        materia: lobbyAudiencias.materia,
        observaciones: lobbyAudiencias.observaciones,
        sourceUrl: lobbyAudiencias.sourceUrl,
      })
      .from(lobbyAudiencias)
      .where(whereClause)
      .orderBy(desc(lobbyAudiencias.fecha))
      .limit(limitNum)
      .offset(offsetNum);

    return res.status(200).json({
      audiencias,
      total: audiencias.length,
      totalCount: countResult.value,
    });
  } catch (error) {
    console.error('Error searching lobby audiencias:', error);
    return res.status(500).json({
      audiencias: [],
      total: 0,
      totalCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
