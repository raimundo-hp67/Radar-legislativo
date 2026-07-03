import * as z from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().optional().default('postgresql://postgres:postgres@localhost:5432/postgres'),
  BETTER_AUTH_URL: z.string().optional().default('http://localhost:3000'),
  BETTER_AUTH_SECRET: z.string().min(32),
  // Legal Tracker
  SLACK_WEBHOOK_URL: z.string().optional(),
  LEGAL_POLL_API_KEY: z.string().optional().default('change-me-in-production'),
  // Vercel Cron authentication
  CRON_SECRET: z.string().optional(),
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
