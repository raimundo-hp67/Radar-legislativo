import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '~/db';
import { legalProjects, projectSnapshots } from '~/db/schema';
import { sql } from 'drizzle-orm';
import { applyRateLimit, getClientIp } from '~/lib/api/rate-limit';

// Public health check endpoint to verify database connection and data
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Public endpoint: throttle per IP
  if (applyRateLimit(req, res, `ip:${getClientIp(req)}:health`, { limit: 30, windowMs: 60_000 })) {
    return;
  }

  try {
    // Count projects and snapshots
    const projectCount = await db.select({ count: sql<number>`count(*)` }).from(legalProjects);
    const snapshotCount = await db.select({ count: sql<number>`count(*)` }).from(projectSnapshots);

    return res.status(200).json({
      status: 'healthy',
      database: 'connected',
      projectCount: Number(projectCount[0].count),
      snapshotCount: Number(snapshotCount[0].count),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check error:', error);
    return res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
