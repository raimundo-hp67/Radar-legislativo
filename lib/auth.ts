import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { sql } from 'drizzle-orm';
import { db } from '~/db';
import { user as userTable } from '~/db/schema';
import { env } from '~/config/env';

/** Google SSO is enabled when both OAuth credentials are configured. */
export const isGoogleSsoEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

/**
 * Open community signup: anyone may self-register with email + password.
 * A domain restriction always wins over this (SSO-only, no open signup).
 */
export const isOpenSignupEnabled = env.AUTH_OPEN_SIGNUP && !env.AUTH_ALLOWED_EMAIL_DOMAIN;

/**
 * CLI escape hatch used by scripts/create-user.ts to provision accounts.
 * Only honored for that process; never set it on a deployed server.
 */
const allowCliProvisioning = process.env.AUTH_PROVISION === '1';

let bootstrapped = false;

/**
 * Whether this installation already has at least one account. An install
 * only ever goes from 0 → 1 users, never back down in normal operation, so
 * once we've confirmed a user exists we cache that forever and skip the DB
 * round trip — otherwise every anonymous visit to /signup would run a query
 * with no rate limit (the BetterAuth rate limiter below only covers
 * /api/auth/*, not this page).
 */
export async function hasAnyUser(): Promise<boolean> {
  if (bootstrapped) return true;
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(userTable);
  bootstrapped = Number(count) > 0;
  return bootstrapped;
}

/**
 * BetterAuth rejects any login/signup whose browser Origin isn't in this
 * list ("Invalid origin"). Two trip-ups muy comunes corriendo local:
 *  - `localhost` y `127.0.0.1` son la misma máquina pero orígenes distintos
 *    para el navegador (`bun run dev` imprime uno, alguien abre el otro);
 *  - si el puerto 3000 está ocupado, Next salta a 3001/3002 y el origen deja
 *    de calzar — el registro/login falla sin explicación para un no técnico.
 * Por eso, cuando la app está configurada como LOCAL (BETTER_AUTH_URL apunta
 * a localhost/127.0.0.1), confiamos en cualquier puerto de esta máquina. En
 * un deploy real (https://...) no se agrega ningún comodín.
 */
function withLocalAlias(url: string): string[] {
  try {
    const { origin, hostname } = new URL(url);
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return [origin, 'http://localhost:*', 'http://127.0.0.1:*'];
    }
    return [origin];
  } catch {
    return [url];
  }
}

const trustedOrigins = [
  ...withLocalAlias(env.BETTER_AUTH_URL),
  ...(env.ADDITIONAL_TRUSTED_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) ?? []),
];

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins,
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: {
    enabled: true,
    // Password-based signup can never prove someone owns an email address —
    // that's only true for Google-verified logins. So when a domain
    // restriction is configured, keep this closed exactly like before this
    // feature existed (CLI script only); domain-based trust stays exclusive
    // to SSO. Without a domain configured, leave it open so the bootstrap
    // path in databaseHooks below can run for a brand-new install.
    disableSignUp: env.AUTH_ALLOWED_EMAIL_DOMAIN ? !allowCliProvisioning : false,
  },
  ...(isGoogleSsoEnabled
    ? {
        socialProviders: {
          google: {
            clientId: env.GOOGLE_CLIENT_ID!,
            clientSecret: env.GOOGLE_CLIENT_SECRET!,
          },
        },
      }
    : {}),
  // Throttle auth endpoints (login brute force, signup spam). In-memory store.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
  },
  databaseHooks: {
    user: {
      create: {
        // Runs for every new account, including first-time Google SSO logins
        // and the password-based signup form.
        before: async (newUser) => {
          if (allowCliProvisioning) {
            return;
          }

          const domain = env.AUTH_ALLOWED_EMAIL_DOMAIN?.trim().toLowerCase();
          if (domain) {
            // Domain-restricted install: ONLY a matching, SSO-verified email
            // gets in — no bootstrap fallback here. Falling through to the
            // no-domain bootstrap check below would let anyone (any Google
            // account, or — since password signup can't verify ownership —
            // anyone typing an @domain address) claim the first account.
            const email = newUser.email?.toLowerCase() ?? '';
            if (email.endsWith(`@${domain}`)) {
              return;
            }
            throw new APIError('FORBIDDEN', {
              message: `Solo cuentas @${domain} pueden acceder a esta aplicación.`,
            });
          }

          // Open community mode: anyone may register (public, free tool).
          // Rate limiting on /api/auth/* (below) blunts signup spam.
          if (env.AUTH_OPEN_SIGNUP) {
            return;
          }

          // No domain configured: allow the very first account (bootstrap)
          // from the /signup form, no terminal needed. Closes automatically
          // the instant that account exists — every account after it needs
          // CLI, SSO, or AUTH_OPEN_SIGNUP.
          if (!(await hasAnyUser())) {
            return;
          }
          throw new APIError('FORBIDDEN', {
            message: 'Este portal ya tiene una cuenta creada. Pídele a quien lo administra que te agregue una.',
          });
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
