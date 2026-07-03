import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { db } from '~/db';
import { env } from '~/config/env';

// Set to true to disable all new signups
const SIGNUPS_DISABLED = true;

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: {
    enabled: true,
  },
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
        before: async () => {
          if (SIGNUPS_DISABLED) {
            throw new APIError('FORBIDDEN', {
              message: 'Los registros están deshabilitados. Esta aplicación es de uso interno.',
            });
          }
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
