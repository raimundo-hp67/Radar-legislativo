import type { NextApiRequest, NextApiResponse } from 'next';
import { desc, isNotNull, sql } from 'drizzle-orm';
import { db } from '~/db';
import { projectSnapshots, legalProjects } from '~/db/schema';
import { protectedHandler } from '~/lib/api/protected-handler';

export default protectedHandler(async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return handleGet(req, res);
});

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { limit = '50', relevance, days } = req.query;

    // Validate and parse limit
    const parsedLimit = Number(limit);
    const limitNum = Math.min(Number.isNaN(parsedLimit) ? 50 : parsedLimit, 100);

    // Build date filter if specified
    let dateFilter: Date | undefined = undefined;
    if (days && typeof days === 'string') {
      const daysNum = Number(days);
      if (!Number.isNaN(daysNum) && daysNum > 0) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysNum);
        dateFilter = cutoffDate;
      }
    }

    // Get snapshots with changes, joined with project info
    const snapshotsWithChanges = await db
      .select({
        snapshot: projectSnapshots,
        project: legalProjects,
      })
      .from(projectSnapshots)
      .innerJoin(legalProjects, sql`${projectSnapshots.boletin} = ${legalProjects.boletin}`)
      .where(isNotNull(projectSnapshots.changesDetected))
      .orderBy(desc(projectSnapshots.fetchedAt))
      .limit(limitNum);

    // Filter by relevance if specified
    let filteredResults = snapshotsWithChanges;
    if (relevance && typeof relevance === 'string') {
      const relevanceUpper = relevance.toUpperCase();
      if (['LOW', 'MEDIUM', 'HIGH'].includes(relevanceUpper)) {
        filteredResults = snapshotsWithChanges.filter(
          (r) => r.project.relevance === relevanceUpper,
        );
      }
    }

    // Filter by date if specified
    if (dateFilter) {
      filteredResults = filteredResults.filter(
        (r) => new Date(r.snapshot.fetchedAt) >= dateFilter,
      );
    }

    // Format the response
    const changes = filteredResults.map(({ snapshot, project }) => ({
      id: snapshot.id,
      boletin: snapshot.boletin,
      title: project.title,
      relevance: project.relevance,
      changes: snapshot.changesDetected,
      fetchedAt: snapshot.fetchedAt,
      stage: snapshot.stage,
      chamberCurrent: snapshot.chamberCurrent,
      lastAction: snapshot.lastAction,
      lastActionDate: snapshot.lastActionDate,
    }));

    return res.status(200).json(changes);
  } catch (error) {
    console.error('Error fetching changes:', error);
    return res.status(500).json({
      error: 'Error al obtener cambios',
      message: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}
