import type { NextApiRequest, NextApiResponse } from 'next';
import { auth, type Session } from '~/lib/auth';
import { applyRateLimit, type RateLimitOptions } from '~/lib/api/rate-limit';

type ProtectedApiHandler = (
  req: NextApiRequest,
  res: NextApiResponse,
  session: Session,
) => Promise<void> | void;

type ProtectedHandlerOptions = {
  /**
   * Per-user, per-route rate limit. Defaults to 100 requests/minute.
   * Use stricter limits for endpoints that hit external APIs (OpenAI,
   * Senado, Ley de Lobby) or trigger heavy work.
   */
  rateLimit?: RateLimitOptions
};

const DEFAULT_RATE_LIMIT: RateLimitOptions = { limit: 100, windowMs: 60_000 };

export function protectedHandler(handler: ProtectedApiHandler, options?: ProtectedHandlerOptions) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Convert Next.js headers to Headers object for better-auth
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
    }

    const session = await auth.api.getSession({
      headers,
    });

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const limitOptions = options?.rateLimit ?? DEFAULT_RATE_LIMIT;
    const routeKey = req.url?.split('?')[0] ?? 'unknown';
    if (applyRateLimit(req, res, `user:${session.user.id}:${routeKey}`, limitOptions)) {
      return;
    }

    return handler(req, res, session);
  };
}
