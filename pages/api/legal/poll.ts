import type { NextApiRequest, NextApiResponse } from 'next';
import { runPoll } from '~/lib/legal/poll-runner';
import { env } from '~/config/env';
import { safeEqual } from '~/lib/api/safe-equal';
import { applyRateLimit, getClientIp } from '~/lib/api/rate-limit';

const DEFAULT_POLL_API_KEY = 'change-me-in-production';

/**
 * Manual poll endpoint - callable via curl or an external cron.
 * Protected by API key in x-api-key header.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Throttle before touching auth: this endpoint triggers heavy scraping.
  if (applyRateLimit(req, res, `ip:${getClientIp(req)}:poll`, { limit: 6, windowMs: 60 * 60_000 })) {
    return;
  }

  // In production, refuse to run with the well-known default key (fail closed).
  if (process.env.NODE_ENV === 'production' && env.LEGAL_POLL_API_KEY === DEFAULT_POLL_API_KEY) {
    console.error('LEGAL_POLL_API_KEY still has its default value — rejecting poll request');
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // Validate API key (constant-time comparison)
  const apiKey = req.headers['x-api-key'];
  if (typeof apiKey !== 'string' || !safeEqual(apiKey, env.LEGAL_POLL_API_KEY)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  try {
    const summary = await runPoll();
    return res.status(200).json(summary);
  } catch (error) {
    console.error('Poll failed:', error);
    return res.status(500).json({
      error: 'Poll failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
