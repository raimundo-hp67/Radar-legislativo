import type { NextApiRequest, NextApiResponse } from 'next';
import * as z from 'zod';
import { db } from '~/db';
import { portalSettings } from '~/db/schema';
import { protectedHandler } from '~/lib/api/protected-handler';

// Logo como data URI (png/jpeg/webp), máx ~2 MB decodificados.
// SVG se rechaza a propósito: puede contener scripts (XSS almacenado si
// algún día se renderiza fuera de <img>).
const MAX_DATA_URL_LENGTH = 2_800_000;

const putSchema = z.object({
  logoDataUrl: z
    .string()
    .max(MAX_DATA_URL_LENGTH, 'La imagen no puede superar los 2 MB')
    .regex(
      /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/,
      'Formato inválido: se aceptan PNG, JPG o WebP',
    )
    .refine(isRealImage, 'El archivo no es una imagen válida')
    .nullable(),
});

/** Verifica la firma de bytes (magic numbers) del contenido decodificado. */
function isRealImage(dataUrl: string): boolean {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  let bytes: Buffer;
  try {
    bytes = Buffer.from(base64, 'base64');
  } catch {
    return false;
  }
  if (bytes.length < 12) return false;
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isWebp = bytes.subarray(0, 4).toString('ascii') === 'RIFF'
    && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  return isPng || isJpeg || isWebp;
}

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
