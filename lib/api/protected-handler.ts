import type { NextApiRequest, NextApiResponse } from 'next';
import { auth, type Session } from '~/lib/auth';

type ProtectedApiHandler = (
  req: NextApiRequest,
  res: NextApiResponse,
  session: Session,
) => Promise<void> | void;

export function protectedHandler(handler: ProtectedApiHandler) {
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

    return handler(req, res, session);
  };
}
