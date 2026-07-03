import type { NextApiResponse } from 'next';
import { db } from '~/db';
import { projectSnapshots } from '~/db/schema';
import { sql, count, isNotNull } from 'drizzle-orm';
import { protectedHandler } from '~/lib/api/protected-handler';

/**
 * GET /api/legal/changes-timeline
 * Returns count of snapshots with detected changes grouped by ISO week (last 12 weeks)
 */
export default protectedHandler(async (_req, res: NextApiResponse) => {
  const rows = await db
    .select({
      week: sql<string>`TO_CHAR(DATE_TRUNC('week', ${projectSnapshots.fetchedAt}), 'YYYY-"W"IW')`,
      count: count(),
    })
    .from(projectSnapshots)
    .where(isNotNull(projectSnapshots.changesDetected))
    .groupBy(sql`DATE_TRUNC('week', ${projectSnapshots.fetchedAt})`)
    .orderBy(sql`DATE_TRUNC('week', ${projectSnapshots.fetchedAt})`)
    .limit(12);

  return res.status(200).json({ weeks: rows });
});
