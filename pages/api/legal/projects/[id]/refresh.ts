import type { NextApiResponse } from 'next';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '~/db';
import { legalProjects, projectSnapshots } from '~/db/schema';
import { protectedHandler } from '~/lib/api/protected-handler';
import { fetchProjectStatus } from '~/lib/legal/congress-scraper';
import { diffSnapshots } from '~/lib/legal/diff-engine';

/**
 * POST /api/legal/projects/[id]/refresh
 * Fetches fresh data from the Senado API for a specific project
 */
export default protectedHandler(async (req, res: NextApiResponse, session) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const id = Number(req.query.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  // Solo un proyecto propio de este usuario.
  const [project] = await db
    .select()
    .from(legalProjects)
    .where(and(eq(legalProjects.id, id), eq(legalProjects.userId, session.user.id)))
    .limit(1);

  if (!project) {
    return res.status(404).json({ error: 'Proyecto no encontrado' });
  }

  try {
    // Fetch data from Senado API
    const scrapedData = await fetchProjectStatus(project.boletin);

    // Get the previous snapshot
    const [previousSnapshot] = await db
      .select()
      .from(projectSnapshots)
      .where(eq(projectSnapshots.boletin, project.boletin))
      .orderBy(desc(projectSnapshots.fetchedAt))
      .limit(1);

    // Calculate diff
    const changes = diffSnapshots(previousSnapshot || null, scrapedData);

    // Create new snapshot
    const [newSnapshot] = await db
      .insert(projectSnapshots)
      .values({
        boletin: project.boletin,
        stage: scrapedData.stage,
        chamberCurrent: scrapedData.chamberCurrent,
        lastAction: scrapedData.lastAction,
        lastActionDate: scrapedData.lastActionDate,
        urgency: scrapedData.urgency,
        commission: scrapedData.commission,
        sourceProvider: 'senado_xml',
        sourceUrl: scrapedData.sourceUrl,
        changesDetected: changes.length > 0 ? changes : null,
      })
      .returning();

    // Update notes with summary if empty
    if (!project.notes) {
      const parts = [];
      if (scrapedData.stage) parts.push(`Estado: ${scrapedData.stage}`);
      if (scrapedData.chamberCurrent) parts.push(`Cámara: ${scrapedData.chamberCurrent}`);
      if (scrapedData.urgency) parts.push(`Urgencia: ${scrapedData.urgency}`);

      if (parts.length > 0) {
        await db
          .update(legalProjects)
          .set({ notes: parts.join(' | '), updatedAt: new Date() })
          .where(and(eq(legalProjects.id, id), eq(legalProjects.userId, session.user.id)));
      }
    }

    return res.status(200).json({
      success: true,
      snapshot: newSnapshot,
      changesDetected: changes.length,
    });
  } catch (error) {
    console.error(`Failed to refresh data for ${project.boletin}:`, error);
    return res.status(500).json({
      error: 'Error al obtener datos del Senado',
      message: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}, { rateLimit: { limit: 10, windowMs: 10 * 60_000 } });
