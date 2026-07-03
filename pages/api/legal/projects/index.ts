import type { NextApiRequest, NextApiResponse } from 'next';
import { desc, eq } from 'drizzle-orm';
import { db } from '~/db';
import { legalProjects, projectSnapshots } from '~/db/schema';
import { protectedHandler } from '~/lib/api/protected-handler';
import { createProjectSchema } from '~/lib/legal/validation';
import { hasRecentChanges } from '~/lib/legal/diff-engine';
import { fetchProjectStatus } from '~/lib/legal/congress-scraper';
import type { ProjectWithSnapshot } from '~/lib/legal/types';

export default protectedHandler(async (req, res) => {
  if (req.method === 'GET') {
    return handleGet(req, res);
  }

  if (req.method === 'POST') {
    return handlePost(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
});

async function handleGet(_req: NextApiRequest, res: NextApiResponse) {
  try {
    // Get all projects
    const projects = await db.select().from(legalProjects).orderBy(desc(legalProjects.createdAt));

    // For each project, get the latest snapshot
    const projectsWithSnapshots: ProjectWithSnapshot[] = await Promise.all(
      projects.map(async (project) => {
        const [latestSnapshot] = await db
          .select()
          .from(projectSnapshots)
          .where(eq(projectSnapshots.boletin, project.boletin))
          .orderBy(desc(projectSnapshots.fetchedAt))
          .limit(1);

        return {
          ...project,
          latestSnapshot: latestSnapshot || null,
          hasRecentChanges: latestSnapshot ? hasRecentChanges(latestSnapshot) : false,
        };
      }),
    );

    return res.status(200).json(projectsWithSnapshots);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return res.status(500).json({
      error: 'Error al obtener proyectos',
      message: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  try {
    const validation = createProjectSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: validation.error.flatten(),
      });
    }

    const { boletin, title, relevance, dateIngreso, estado, camara, urgencia, comision, notes } = validation.data;

    // Check if boletin already exists
    const [existing] = await db
      .select()
      .from(legalProjects)
      .where(eq(legalProjects.boletin, boletin))
      .limit(1);

    if (existing) {
      return res.status(409).json({ error: 'Ya existe un proyecto con este boletín' });
    }

    // Try to fetch data from scraper to auto-populate fields
    let scrapedEstado = estado || null;
    let scrapedCamara = camara || null;
    let scrapedUrgencia = urgencia || null;
    let scrapedComision = comision || null;
    let initialSnapshot = null;

    try {
      const scrapedData = await fetchProjectStatus(boletin);

      // Auto-populate fields from scraper if not provided by user
      if (!estado && scrapedData.stage) {
        // Capitalize first letter
        scrapedEstado = scrapedData.stage.charAt(0).toUpperCase() + scrapedData.stage.slice(1);
      }
      if (!camara && scrapedData.chamberCurrent) {
        // Normalize chamber name
        scrapedCamara = scrapedData.chamberCurrent.includes('Diputados') ? 'Diputados' : 'Senado';
      }
      if (!urgencia && scrapedData.urgency) {
        scrapedUrgencia = scrapedData.urgency;
      }
      if (!comision && scrapedData.commission) {
        scrapedComision = scrapedData.commission;
      }

      initialSnapshot = await db.transaction(async (tx) => {
        const [snapshot] = await tx
          .insert(projectSnapshots)
          .values({
            boletin,
            stage: scrapedData.stage,
            chamberCurrent: scrapedData.chamberCurrent,
            lastAction: scrapedData.lastAction,
            lastActionDate: scrapedData.lastActionDate,
            urgency: scrapedData.urgency,
            commission: scrapedData.commission,
            sourceProvider: 'senado_web',
            sourceUrl: scrapedData.sourceUrl,
            changesDetected: null,
          })
          .returning();
        return snapshot;
      });
    } catch (scraperError) {
      console.error(`Failed to fetch initial data for ${boletin}:`, scraperError);
      // Continue without scraped data - user can edit manually
    }

    const [newProject] = await db.transaction(async (tx) => {
      return tx
        .insert(legalProjects)
        .values({
          boletin,
          title,
          relevance,
          dateIngreso: dateIngreso || null,
          estado: scrapedEstado,
          camara: scrapedCamara,
          urgencia: scrapedUrgencia,
          comision: scrapedComision,
          notes: notes || null,
        })
        .returning();
    });

    return res.status(201).json({
      ...newProject,
      latestSnapshot: initialSnapshot,
      hasRecentChanges: false,
    });
  } catch (error) {
    console.error('Error creating project:', error);
    return res.status(500).json({
      error: 'Error al crear proyecto',
      message: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}
