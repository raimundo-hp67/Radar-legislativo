import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, desc } from 'drizzle-orm';
import { db } from '~/db';
import { legalProjects, projectSnapshots } from '~/db/schema';
import { protectedHandler } from '~/lib/api/protected-handler';
import { updateProjectSchema } from '~/lib/legal/validation';
import { hasRecentChanges } from '~/lib/legal/diff-engine';

export default protectedHandler(async (req, res, session) => {
  const { id } = req.query;

  if (typeof id !== 'string' || isNaN(Number(id))) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const projectId = Number(id);
  const userId = session.user.id;

  if (req.method === 'GET') {
    return handleGet(projectId, userId, res);
  }

  if (req.method === 'PUT') {
    return handlePut(projectId, userId, req, res);
  }

  if (req.method === 'DELETE') {
    return handleDelete(projectId, userId, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
});

async function handleGet(id: number, userId: string, res: NextApiResponse) {
  try {
    // Solo si el proyecto es de este usuario (si no, 404 — ni siquiera revela
    // que existe para otro).
    const [project] = await db
      .select()
      .from(legalProjects)
      .where(and(eq(legalProjects.id, id), eq(legalProjects.userId, userId)))
      .limit(1);

    if (!project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Get all snapshots for this project
    const snapshots = await db
      .select()
      .from(projectSnapshots)
      .where(eq(projectSnapshots.boletin, project.boletin))
      .orderBy(desc(projectSnapshots.fetchedAt));

    const latestSnapshot = snapshots[0] || null;

    return res.status(200).json({
      ...project,
      latestSnapshot,
      hasRecentChanges: latestSnapshot ? hasRecentChanges(latestSnapshot) : false,
      snapshots,
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    return res.status(500).json({
      error: 'Error al obtener proyecto',
      message: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}

async function handlePut(id: number, userId: string, req: NextApiRequest, res: NextApiResponse) {
  try {
    const validation = updateProjectSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: validation.error.flatten(),
      });
    }

    const [existing] = await db
      .select()
      .from(legalProjects)
      .where(and(eq(legalProjects.id, id), eq(legalProjects.userId, userId)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // ¿El nuevo boletín choca con OTRO proyecto del mismo usuario?
    if (validation.data.boletin && validation.data.boletin !== existing.boletin) {
      const [conflict] = await db
        .select()
        .from(legalProjects)
        .where(and(eq(legalProjects.boletin, validation.data.boletin), eq(legalProjects.userId, userId)))
        .limit(1);

      if (conflict) {
        return res.status(409).json({ error: 'Ya sigues otro proyecto con este boletín' });
      }
    }

    const [updated] = await db
      .update(legalProjects)
      .set({
        ...validation.data,
        updatedAt: new Date(),
      })
      .where(and(eq(legalProjects.id, id), eq(legalProjects.userId, userId)))
      .returning();

    return res.status(200).json(updated);
  } catch (error) {
    console.error('Error updating project:', error);
    return res.status(500).json({
      error: 'Error al actualizar proyecto',
      message: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}

async function handleDelete(id: number, userId: string, res: NextApiResponse) {
  try {
    const [existing] = await db
      .select()
      .from(legalProjects)
      .where(and(eq(legalProjects.id, id), eq(legalProjects.userId, userId)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Solo se borra el proyecto de este usuario. Los snapshots son datos
    // públicos compartidos por boletín (otros usuarios pueden seguir el mismo
    // proyecto), así que NO se tocan.
    await db.delete(legalProjects).where(and(eq(legalProjects.id, id), eq(legalProjects.userId, userId)));

    return res.status(200).json({ success: true, deletedBoletin: existing.boletin });
  } catch (error) {
    console.error('Error deleting project:', error);
    return res.status(500).json({
      error: 'Error al eliminar proyecto',
      message: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}
