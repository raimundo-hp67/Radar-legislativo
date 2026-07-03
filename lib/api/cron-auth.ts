import { timingSafeEqual } from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { env } from '~/config/env';

/** Constant-time string comparison (avoids leaking secrets via timing). */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verify a Vercel Cron request (Authorization: Bearer <CRON_SECRET>).
 *
 * In production the secret is REQUIRED: if CRON_SECRET is not configured,
 * every request is rejected (fail closed) instead of accepting the literal
 * string "Bearer undefined". In development the check is skipped so crons
 * can be exercised locally.
 *
 * Returns `true` when the request was rejected (response already sent).
 */
export function rejectUnauthorizedCron(req: NextApiRequest, res: NextApiResponse): boolean {
  if (process.env.NODE_ENV !== 'production') return false;

  if (!env.CRON_SECRET) {
    console.error('CRON_SECRET is not configured — rejecting cron request');
    res.status(401).json({ error: 'Unauthorized' });
    return true;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !safeEqual(authHeader, `Bearer ${env.CRON_SECRET}`)) {
    console.error('Unauthorized cron request');
    res.status(401).json({ error: 'Unauthorized' });
    return true;
  }

  return false;
}
