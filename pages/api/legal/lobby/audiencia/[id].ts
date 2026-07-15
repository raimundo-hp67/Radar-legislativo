import type { NextApiRequest, NextApiResponse } from 'next';
import { eq } from 'drizzle-orm';
import { db } from '~/db';
import { lobbyAudiencias } from '~/db/schema';
import { protectedHandler } from '~/lib/api/protected-handler';

/**
 * GET /api/legal/lobby/audiencia/[id]
 * Detalle completo de una audiencia de lobby (todos los campos guardados).
 * Las audiencias son datos públicos compartidos, así que basta con sesión.
 */
export default protectedHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const id = Number(req.query.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const [audiencia] = await db
    .select()
    .from(lobbyAudiencias)
    .where(eq(lobbyAudiencias.id, id))
    .limit(1);

  if (!audiencia) {
    return res.status(404).json({ error: 'Audiencia no encontrada' });
  }

  return res.status(200).json(audiencia);
});
