import type { NextApiResponse } from 'next';
import { db } from '~/db';
import { projectSnapshots, legalProjects } from '~/db/schema';
import { sql, count, and, eq, isNotNull } from 'drizzle-orm';
import { protectedHandler } from '~/lib/api/protected-handler';

/**
 * GET /api/legal/changes-timeline
 * Returns count of snapshots with detected changes grouped by ISO week (last 12
 * weeks), limitado a los boletines que sigue ESTE usuario.
 */
export default protectedHandler(async (_req, res: NextApiResponse, session) => {
  const rows = await db
    .select({
      week: sql<string>`TO_CHAR(DATE_TRUNC('week', ${projectSnapshots.fetchedAt}), 'YYYY-"W"IW')`,
      count: count(),
    })
    .from(projectSnapshots)
    .innerJoin(legalProjects, eq(projectSnapshots.boletin, legalProjects.boletin))
    .where(and(isNotNull(projectSnapshots.changesDetected), eq(legalProjects.userId, session.user.id)))
    .groupBy(sql`DATE_TRUNC('week', ${projectSnapshots.fetchedAt})`)
    .orderBy(sql`DATE_TRUNC('week', ${projectSnapshots.fetchedAt})`)
    .limit(12);

  return res.status(200).json({ weeks: rows });
});
