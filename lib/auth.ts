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
 * CLI escape hatch used by scripts/create-user.ts to provision accounts.
 * Only honored for that process; never set it on a deployed server.
 */
const allowCliProvisioning = process.env.AUTH_PROVISION === '1';

/**
 * BetterAuth rejects any login/signup whose browser Origin isn't in this
 * list ("Invalid origin"). `localhost` and `127.0.0.1` are the same machine
 * but different origins for a browser — a very common trip-up when running
 * locally (`bun run dev` prints one, someone opens the other). We trust both
 * automatically so that mismatch never locks anyone out.
 */
function withLocalAlias(url: string): string[] {
  try {
    const { origin, hostname } = new URL(url);
    if (hostname === 'localhost') return [origin, origin.replace('localhost', '127.0.0.1')];
    if (hostname === '127.0.0.1') return [origin, origin.replace('127.0.0.1', 'localhost')];
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
    // The actual signup gate lives in databaseHooks.user.create.before below
    // (bootstrap / domain / CLI) — this stays open so that gate can run.
    disableSignUp: false,
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
  // Throttle auth endpoints (login brute force, signup spam). In-memory store;
  // per-instance on serverless, which still blunts single-source bursts.
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
        //
        // Allowed to go through when ANY of:
        //  - CLI provisioning (scripts/create-user.ts)
        //  - email domain matches AUTH_ALLOWED_EMAIL_DOMAIN (SSO auto-provision)
        //  - BOOTSTRAP: this is a brand-new install with zero users yet, so
        //    whoever fills the signup form on /signup becomes the first
        //    account. This is what lets a fresh `bun run dev` (or a freshly
        //    deployed instance) be usable straight from the browser, with no
        //    terminal step. The instant that first account exists, this
        //    path closes again — every account after it needs CLI or SSO,
        //    same as before.
        // Otherwise: rejected (fail closed).
        before: async (newUser) => {
          if (allowCliProvisioning) {
            return;
          }
          const domain = env.AUTH_ALLOWED_EMAIL_DOMAIN?.trim().toLowerCase();
          const email = newUser.email?.toLowerCase() ?? '';
          if (domain && email.endsWith(`@${domain}`)) {
            return;
          }
          const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(userTable);
          if (Number(count) === 0) {
            return;
          }
          throw new APIError('FORBIDDEN', {
            message: domain
              ? `Solo cuentas @${domain} pueden acceder a esta aplicación.`
              : 'Este portal ya tiene una cuenta creada. Pídele a quien lo administra que te agregue una.',
          });
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
