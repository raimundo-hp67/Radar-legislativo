import type { NextApiRequest, NextApiResponse } from 'next';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '~/db';
import { legalProjects, projectSnapshots } from '~/db/schema';
import { protectedHandler } from '~/lib/api/protected-handler';
import { createProjectSchema } from '~/lib/legal/validation';
import { hasRecentChanges } from '~/lib/legal/diff-engine';
import { fetchProjectStatus } from '~/lib/legal/congress-scraper';
import type { ProjectWithSnapshot } from '~/lib/legal/types';

export default protectedHandler(async (req, res, session) => {
  if (req.method === 'GET') {
    return handleGet(req, res, session.user.id);
  }

  if (req.method === 'POST') {
    return handlePost(req, res, session.user.id);
  }

  return res.status(405).json({ error: 'Method not allowed' });
});

async function handleGet(_req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    // Solo los proyectos de este usuario (cada uno tiene su radar privado).
    const projects = await db
      .select()
      .from(legalProjects)
      .where(eq(legalProjects.userId, userId))
      .orderBy(desc(legalProjects.createdAt));

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

async function handlePost(req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    const validation = createProjectSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: validation.error.flatten(),
      });
    }

    const { boletin, title, relevance, dateIngreso, estado, camara, urgencia, comision, notes } = validation.data;

    // ¿Este usuario ya sigue este boletín? (otro usuario sí puede tenerlo)
    const [existing] = await db
      .select()
      .from(legalProjects)
      .where(and(eq(legalProjects.boletin, boletin), eq(legalProjects.userId, userId)))
      .limit(1);

    if (existing) {
      return res.status(409).json({ error: 'Ya sigues un proyecto con este boletín' });
    }

    let scrapedEstado = estado || null;
    let scrapedCamara = camara || null;
    let scrapedUrgencia = urgencia || null;
    let scrapedComision = comision || null;
    let initialSnapshot = null;

    // Los snapshots (datos públicos scrapeados) se comparten por boletín. Si
    // otro usuario ya seguía este proyecto, reutilizamos el último snapshot en
    // vez de volver a scrapear; si no existe ninguno, scrapeamos una vez.
    const [existingSnapshot] = await db
      .select()
      .from(projectSnapshots)
      .where(eq(projectSnapshots.boletin, boletin))
      .orderBy(desc(projectSnapshots.fetchedAt))
      .limit(1);

    const applyAutofill = (data: {
      stage?: string | null
      chamberCurrent?: string | null
      urgency?: string | null
      commission?: string | null
    }) => {
      if (!estado && data.stage) scrapedEstado = data.stage.charAt(0).toUpperCase() + data.stage.slice(1);
      if (!camara && data.chamberCurrent) scrapedCamara = data.chamberCurrent.includes('Diputados') ? 'Diputados' : 'Senado';
      if (!urgencia && data.urgency) scrapedUrgencia = data.urgency;
      if (!comision && data.commission) scrapedComision = data.commission;
    };

    if (existingSnapshot) {
      applyAutofill(existingSnapshot);
      initialSnapshot = existingSnapshot;
    } else {
      try {
        const scrapedData = await fetchProjectStatus(boletin);
        applyAutofill(scrapedData);
        const [snapshot] = await db
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
        initialSnapshot = snapshot;
      } catch (scraperError) {
        console.error(`Failed to fetch initial data for ${boletin}:`, scraperError);
        // Continue without scraped data - user can edit manually
      }
    }

    const [newProject] = await db
      .insert(legalProjects)
      .values({
        userId,
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
