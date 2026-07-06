import * as z from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().optional().default('postgresql://postgres:postgres@localhost:5432/postgres'),
  BETTER_AUTH_URL: z.string().optional().default('http://localhost:3000'),
  BETTER_AUTH_SECRET: z.string().min(32),
  // Extra dominios permitidos para login además de BETTER_AUTH_URL (coma-
  // separados). Útil si la app responde en más de un dominio (ej: dominio
  // propio + el *.vercel.app que Vercel asigna automáticamente).
  ADDITIONAL_TRUSTED_ORIGINS: z.string().optional(),
  // Legal Tracker
  SLACK_WEBHOOK_URL: z.string().optional(),
  LEGAL_POLL_API_KEY: z.string().optional().default('change-me-in-production'),
  // Built-in auto-updater interval (hours) for self-hosted/local runs.
  // 0 disables it. Ignored on Vercel (cron jobs do this work there).
  AUTO_UPDATE_INTERVAL_HOURS: z.preprocess(
    (v) => (v === '' || v === undefined ? undefined : v),
    z.coerce.number().min(0).default(6),
  ),
  // Vercel Cron authentication
  CRON_SECRET: z.string().optional(),
  // Google SSO (OAuth). When both are set, "Continue with Google" is enabled.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  // When set, users with this email domain are auto-provisioned on their
  // first Google SSO login (e.g. "example.com"). When unset, all account
  // creation is blocked.
  AUTH_ALLOWED_EMAIL_DOMAIN: z.string().optional(),
  // OpenAI for the lobby / projects analysis chat agents
  OPENAI_API_KEY: z.string().optional(),
  // Official Ley de Lobby API (leylobby.gob.cl). When set, used as the primary
  // lobby source; otherwise we fall back to the public InfoLobby/VirtuosoLobby feed.
  LEYLOBBY_API_KEY: z.string().optional(),
  // Comma-separated institution codes to pull from the official Ley de Lobby API
  // (e.g. "AI060,AE001"). Required for the official source to do anything.
  LEYLOBBY_INSTITUCIONES: z.string().optional(),
});

export const env = envSchema.parse(process.env);
