import type { NextApiRequest, NextApiResponse } from 'next';
import { eq, desc } from 'drizzle-orm';
import { db } from '~/db';
import { legalProjects, projectSnapshots } from '~/db/schema';
import { protectedHandler } from '~/lib/api/protected-handler';
import { updateProjectSchema } from '~/lib/legal/validation';
import { hasRecentChanges } from '~/lib/legal/diff-engine';

export default protectedHandler(async (req, res) => {
  const { id } = req.query;

  if (typeof id !== 'string' || isNaN(Number(id))) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const projectId = Number(id);

  if (req.method === 'GET') {
    return handleGet(projectId, res);
  }

  if (req.method === 'PUT') {
    return handlePut(projectId, req, res);
  }

  if (req.method === 'DELETE') {
    return handleDelete(projectId, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
});

async function handleGet(id: number, res: NextApiResponse) {
  try {
    const [project] = await db
      .select()
      .from(legalProjects)
      .where(eq(legalProjects.id, id))
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

async function handlePut(id: number, req: NextApiRequest, res: NextApiResponse) {
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
      .where(eq(legalProjects.id, id))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Check if new boletin conflicts with another project
    if (validation.data.boletin && validation.data.boletin !== existing.boletin) {
      const [conflict] = await db
        .select()
        .from(legalProjects)
        .where(eq(legalProjects.boletin, validation.data.boletin))
        .limit(1);

      if (conflict) {
        return res.status(409).json({ error: 'Ya existe otro proyecto con este boletín' });
      }
    }

    const [updated] = await db
      .update(legalProjects)
      .set({
        ...validation.data,
        updatedAt: new Date(),
      })
      .where(eq(legalProjects.id, id))
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

async function handleDelete(id: number, res: NextApiResponse) {
  try {
    const [existing] = await db
      .select()
      .from(legalProjects)
      .where(eq(legalProjects.id, id))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    await db.transaction(async (tx) => {
      await tx.delete(projectSnapshots).where(eq(projectSnapshots.boletin, existing.boletin));
      await tx.delete(legalProjects).where(eq(legalProjects.id, id));
    });

    return res.status(200).json({ success: true, deletedBoletin: existing.boletin });
  } catch (error) {
    console.error('Error deleting project:', error);
    return res.status(500).json({
      error: 'Error al eliminar proyecto',
      message: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}
