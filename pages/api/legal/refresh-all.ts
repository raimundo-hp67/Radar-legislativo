import type { NextApiResponse } from 'next';
import { desc, eq } from 'drizzle-orm';
import { db } from '~/db';
import { legalProjects, projectSnapshots } from '~/db/schema';
import { protectedHandler } from '~/lib/api/protected-handler';
import { fetchProjectStatus } from '~/lib/legal/congress-scraper';
import { diffSnapshots } from '~/lib/legal/diff-engine';

/**
 * POST /api/legal/refresh-all
 * Fetches fresh data from the Senado API for all projects
 * Updates project fields and creates snapshots for history
 */
export default protectedHandler(async (req, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get all projects
  const projects = await db.select().from(legalProjects);

  const results = {
    total: projects.length,
    success: 0,
    failed: 0,
    updated: 0,
    errors: [] as string[],
  };

  for (const project of projects) {
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

      // Create new snapshot for history
      await db
        .insert(projectSnapshots)
        .values({
          boletin: project.boletin,
          stage: scrapedData.stage,
          chamberCurrent: scrapedData.chamberCurrent,
          lastAction: scrapedData.lastAction,
          lastActionDate: scrapedData.lastActionDate,
          urgency: scrapedData.urgency,
          commission: scrapedData.commission,
          sourceProvider: 'senado_web',
          sourceUrl: scrapedData.sourceUrl,
          changesDetected: changes.length > 0 ? changes : null,
        });

      // Update project fields from scraped data (only if currently empty)
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      let fieldsUpdated = false;

      if (!project.estado && scrapedData.stage) {
        // Capitalize first letter
        updateData.estado = scrapedData.stage.charAt(0).toUpperCase() + scrapedData.stage.slice(1);
        fieldsUpdated = true;
      }
      if (!project.camara && scrapedData.chamberCurrent) {
        updateData.camara = scrapedData.chamberCurrent.includes('Diputados') ? 'Diputados' : 'Senado';
        fieldsUpdated = true;
      }
      if (!project.urgencia && scrapedData.urgency) {
        updateData.urgencia = scrapedData.urgency;
        fieldsUpdated = true;
      }
      if (!project.comision && scrapedData.commission) {
        updateData.comision = scrapedData.commission;
        fieldsUpdated = true;
      }

      if (fieldsUpdated || Object.keys(updateData).length > 1) {
        await db
          .update(legalProjects)
          .set(updateData)
          .where(eq(legalProjects.id, project.id));
        results.updated++;
      }

      results.success++;

      // Add delay between requests to be respectful to the API
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      results.failed++;
      results.errors.push(`${project.boletin}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  return res.status(200).json(results);
});
