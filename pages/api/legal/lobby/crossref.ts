import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '~/db';
import { lobbyAudiencias } from '~/db/schema';
import { sql, ilike, and, count, desc } from 'drizzle-orm';
import { protectedHandler } from '~/lib/api/protected-handler';

export default protectedHandler(async (
  req: NextApiRequest,
  res: NextApiResponse,
) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { institution, organization } = req.query;

  try {
    if (institution && organization) {
      const audiencias = await db
        .select({
          id: lobbyAudiencias.id,
          fecha: lobbyAudiencias.fecha,
          sujetoPasivo: lobbyAudiencias.sujetoPasivo,
          sujetoPasivoCargo: lobbyAudiencias.sujetoPasivoCargo,
          sujetoPasivoInstitucion: lobbyAudiencias.sujetoPasivoInstitucion,
          sujetoActivo: lobbyAudiencias.sujetoActivo,
          sujetoActivoOrganizacion: lobbyAudiencias.sujetoActivoOrganizacion,
          materia: lobbyAudiencias.materia,
          sourceUrl: lobbyAudiencias.sourceUrl,
        })
        .from(lobbyAudiencias)
        .where(
          and(
            ilike(lobbyAudiencias.sujetoPasivoInstitucion, `%${institution as string}%`),
            ilike(lobbyAudiencias.searchText, `%${(organization as string).toLowerCase()}%`),
          ),
        )
        .orderBy(desc(lobbyAudiencias.fecha))
        .limit(50);

      return res.status(200).json({
        type: 'detail',
        institution,
        organization,
        count: audiencias.length,
        audiencias,
      });
    }

    if (institution) {
      const topActivos = await db
        .select({
          activo: lobbyAudiencias.sujetoActivo,
          count: count(),
        })
        .from(lobbyAudiencias)
        .where(ilike(lobbyAudiencias.sujetoPasivoInstitucion, `%${institution as string}%`))
        .groupBy(lobbyAudiencias.sujetoActivo)
        .orderBy(desc(count()))
        .limit(15);

      const topPasivos = await db
        .select({
          name: lobbyAudiencias.sujetoPasivo,
          cargo: lobbyAudiencias.sujetoPasivoCargo,
          count: count(),
        })
        .from(lobbyAudiencias)
        .where(ilike(lobbyAudiencias.sujetoPasivoInstitucion, `%${institution as string}%`))
        .groupBy(lobbyAudiencias.sujetoPasivo, lobbyAudiencias.sujetoPasivoCargo)
        .orderBy(desc(count()))
        .limit(10);

      const totalMeetings = await db
        .select({ value: count() })
        .from(lobbyAudiencias)
        .where(ilike(lobbyAudiencias.sujetoPasivoInstitucion, `%${institution as string}%`));

      return res.status(200).json({
        type: 'institution',
        institution,
        totalMeetings: totalMeetings[0].value,
        topActivos: topActivos.map((r) => ({ name: r.activo, count: r.count })),
        topPasivos: topPasivos.map((r) => ({ name: r.name, cargo: r.cargo, count: r.count })),
      });
    }

    // Default: top institution-activo pairs
    const topPairs = await db
      .select({
        institution: lobbyAudiencias.sujetoPasivoInstitucion,
        activo: lobbyAudiencias.sujetoActivo,
        count: count(),
      })
      .from(lobbyAudiencias)
      .where(sql`${lobbyAudiencias.sujetoActivo} IS NOT NULL AND ${lobbyAudiencias.sujetoActivo} != ''`)
      .groupBy(lobbyAudiencias.sujetoPasivoInstitucion, lobbyAudiencias.sujetoActivo)
      .orderBy(desc(count()))
      .limit(20);

    const institutions = await db
      .select({ name: lobbyAudiencias.sujetoPasivoInstitucion })
      .from(lobbyAudiencias)
      .groupBy(lobbyAudiencias.sujetoPasivoInstitucion)
      .orderBy(lobbyAudiencias.sujetoPasivoInstitucion);

    return res.status(200).json({
      type: 'overview',
      topPairs: topPairs.map((r) => ({
        institution: r.institution,
        activo: r.activo,
        count: r.count,
      })),
      institutions: institutions.map((r) => r.name).filter(Boolean),
    });
  } catch (error) {
    console.error('Error in lobby crossref:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
