import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '~/db';
import { lobbyAudiencias } from '~/db/schema';
import { sql, count, desc } from 'drizzle-orm';
import { protectedHandler } from '~/lib/api/protected-handler';

export default protectedHandler(async (
  req: NextApiRequest,
  res: NextApiResponse,
) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const [topInstitutions, topPasivos, topMaterias, monthlyDistribution, totalResult, uniqueInstitutions, uniquePeople] = await Promise.all([
      db
        .select({
          name: lobbyAudiencias.sujetoPasivoInstitucion,
          count: count(),
        })
        .from(lobbyAudiencias)
        .groupBy(lobbyAudiencias.sujetoPasivoInstitucion)
        .orderBy(desc(count()))
        .limit(10),

      db
        .select({
          name: lobbyAudiencias.sujetoPasivo,
          cargo: lobbyAudiencias.sujetoPasivoCargo,
          institution: lobbyAudiencias.sujetoPasivoInstitucion,
          count: count(),
        })
        .from(lobbyAudiencias)
        .groupBy(
          lobbyAudiencias.sujetoPasivo,
          lobbyAudiencias.sujetoPasivoCargo,
          lobbyAudiencias.sujetoPasivoInstitucion,
        )
        .orderBy(desc(count()))
        .limit(15),

      db
        .select({
          name: lobbyAudiencias.materia,
          count: count(),
        })
        .from(lobbyAudiencias)
        .groupBy(lobbyAudiencias.materia)
        .orderBy(desc(count()))
        .limit(10),

      db
        .select({
          month: sql<string>`SUBSTRING(${lobbyAudiencias.fecha}, 1, 7)`,
          count: count(),
        })
        .from(lobbyAudiencias)
        .groupBy(sql`SUBSTRING(${lobbyAudiencias.fecha}, 1, 7)`)
        .orderBy(sql`SUBSTRING(${lobbyAudiencias.fecha}, 1, 7)`),

      db
        .select({ value: count() })
        .from(lobbyAudiencias),

      db
        .select({ value: sql<number>`COUNT(DISTINCT ${lobbyAudiencias.sujetoPasivoInstitucion})` })
        .from(lobbyAudiencias),

      db
        .select({ value: sql<number>`COUNT(DISTINCT ${lobbyAudiencias.sujetoPasivo})` })
        .from(lobbyAudiencias),
    ]);

    return res.status(200).json({
      total: Number(totalResult[0].value),
      // COUNT(DISTINCT ...) llega como string (bigint de Postgres): normalizar
      uniqueInstitutions: Number(uniqueInstitutions[0].value),
      uniquePeople: Number(uniquePeople[0].value),
      topInstitutions: topInstitutions.map((r) => ({
        name: r.name,
        count: r.count,
      })),
      topPasivos: topPasivos.map((r) => ({
        name: r.name,
        cargo: r.cargo,
        institution: r.institution,
        count: r.count,
      })),
      topMaterias: topMaterias.map((r) => ({
        name: r.name,
        count: r.count,
      })),
      monthlyDistribution: monthlyDistribution.map((r) => ({
        month: r.month,
        count: r.count,
      })),
    });
  } catch (error) {
    console.error('Error fetching lobby analytics:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
