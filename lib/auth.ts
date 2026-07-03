import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { db } from '~/db';
import { env } from '~/config/env';

/** Google SSO is enabled when both OAuth credentials are configured. */
export const isGoogleSsoEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

/**
 * CLI escape hatch used by scripts/create-user.ts to provision accounts.
 * Only honored for that process; never set it on a deployed server.
 */
const allowCliProvisioning = process.env.AUTH_PROVISION === '1';

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: {
    enabled: true,
    // Password-based self-signup stays off: emails are not verified, so anyone
    // could claim an allowed-domain address. Accounts are provisioned via
    // Google SSO (verified emails) or scripts/create-user.ts.
    disableSignUp: !allowCliProvisioning,
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
        // Runs for every new account, including first-time Google SSO logins.
        // When AUTH_ALLOWED_EMAIL_DOMAIN is set, users of that domain are
        // auto-provisioned on their first SSO login; everyone else is
        // rejected. When unset, all account creation is blocked (fail closed).
        before: async (user) => {
          if (allowCliProvisioning) {
            return;
          }
          const domain = env.AUTH_ALLOWED_EMAIL_DOMAIN?.trim().toLowerCase();
          const email = user.email?.toLowerCase() ?? '';
          if (domain && email.endsWith(`@${domain}`)) {
            return;
          }
          throw new APIError('FORBIDDEN', {
            message: domain
              ? `Solo cuentas @${domain} pueden acceder a esta aplicación.`
              : 'Los registros están deshabilitados. Esta aplicación es de uso interno.',
          });
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
