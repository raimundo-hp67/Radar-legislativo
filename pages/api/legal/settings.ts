import type { NextApiRequest, NextApiResponse } from 'next';
import * as z from 'zod';
import { db } from '~/db';
import { portalSettings } from '~/db/schema';
import { protectedHandler } from '~/lib/api/protected-handler';

// Logo como data URI (png/jpeg/webp/svg), máx ~2 MB decodificados
const MAX_DATA_URL_LENGTH = 2_800_000;

const putSchema = z.object({
  logoDataUrl: z
    .string()
    .max(MAX_DATA_URL_LENGTH, 'La imagen no puede superar los 2 MB')
    .regex(
      /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/,
      'Formato inválido: se aceptan PNG, JPG, WebP o SVG',
    )
    .nullable(),
});

export const config = {
  api: { bodyParser: { sizeLimit: '4mb' } },
};

/**
 * GET  /api/legal/settings — personalización actual del portal
 * PUT  /api/legal/settings — actualizar (logoDataUrl: data URI o null para quitar)
 */
export default protectedHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method === 'GET') {
    const [settings] = await db.select().from(portalSettings).limit(1);
    return res.status(200).json({ logoDataUrl: settings?.logoDataUrl ?? null });
  }

  if (req.method === 'PUT') {
    const parsed = putSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Datos inválidos',
      });
    }

    const [existing] = await db.select().from(portalSettings).limit(1);
    if (existing) {
      await db
        .update(portalSettings)
        .set({ logoDataUrl: parsed.data.logoDataUrl, updatedAt: new Date() });
    } else {
      await db.insert(portalSettings).values({ logoDataUrl: parsed.data.logoDataUrl });
    }

    return res.status(200).json({ logoDataUrl: parsed.data.logoDataUrl });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}, { rateLimit: { limit: 20, windowMs: 60_000 } });
