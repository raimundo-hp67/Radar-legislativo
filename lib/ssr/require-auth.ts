import type { IncomingHttpHeaders } from 'node:http';
import type {
  GetServerSideProps,
  GetServerSidePropsContext,
  GetServerSidePropsResult,
} from 'next';

import { auth } from '~/lib/auth';

function toHeaders(reqHeaders: IncomingHttpHeaders) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(reqHeaders)) {
    if (typeof value === 'string') {
      headers.set(key, value);
    } else if (Array.isArray(value)) {
      headers.set(key, value.join(','));
    }
  }
  return headers;
}

type Session = Awaited<ReturnType<typeof auth.api.getSession>>;
type User = NonNullable<Session>['user'];

export type SerializedUser = Omit<User, 'createdAt' | 'updatedAt'> & {
  createdAt: string
  updatedAt: string
};

/**
 * Converts Date fields to ISO strings for Next.js serialization.
 */
export function serializeUser(user: User): SerializedUser {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

type RequireAuthOptions = {
  redirectTo?: string
};

type AuthedHandler<P> = (
  ctx: GetServerSidePropsContext,
  session: NonNullable<Session>,
) => Promise<GetServerSidePropsResult<P>> | GetServerSidePropsResult<P>;

/**
 * Pages Router auth guard for `getServerSideProps`.
 *
 * - Redirects unauthenticated requests to `/login` (configurable)
 * - Provides the BetterAuth session to your handler
 */
export function requireAuth<P extends Record<string, unknown>>(
  handler: AuthedHandler<P>,
  options: RequireAuthOptions = {},
): GetServerSideProps<P> {
  return async (ctx) => {
    const session = await auth.api.getSession({
      headers: toHeaders(ctx.req.headers),
    });

    if (!session) {
      const returnTo = ctx.resolvedUrl;
      const loginUrl = options.redirectTo ?? '/login';
      const destination = `${loginUrl}?returnTo=${encodeURIComponent(returnTo)}`;
      return {
        redirect: {
          destination,
          permanent: false,
        },
      };
    }

    return handler(ctx, session);
  };
}
