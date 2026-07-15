import * as z from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().optional().default('postgresql://postgres:postgres@localhost:5432/postgres'),
  BETTER_AUTH_URL: z.string().optional().default('http://localhost:3000'),
  BETTER_AUTH_SECRET: z.string().min(32),
  // Extra orígenes permitidos para login además de BETTER_AUTH_URL (coma-
  // separados). Útil si abres la app desde otra dirección además de
  // localhost (ej: http://192.168.1.10:3000 desde otro computador de la red).
  ADDITIONAL_TRUSTED_ORIGINS: z.string().optional(),
  // Legal Tracker
  SLACK_WEBHOOK_URL: z.string().optional(),
  LEGAL_POLL_API_KEY: z.string().optional().default('change-me-in-production'),
  // Built-in auto-updater interval (hours): while the app is running it
  // refreshes projects, lobby and the bill catalog. 0 disables it.
  AUTO_UPDATE_INTERVAL_HOURS: z.preprocess(
    (v) => (v === '' || v === undefined ? undefined : v),
    z.coerce.number().min(0).default(6),
  ),
  // Google SSO (OAuth). When both are set, "Continue with Google" is enabled.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  // When set, users with this email domain are auto-provisioned on their
  // first Google SSO login (e.g. "example.com"). When unset, all account
  // creation is blocked.
  AUTH_ALLOWED_EMAIL_DOMAIN: z.string().optional(),
  // Open signup: when "1"/"true", anyone who can reach this install can
  // self-register with email + password from /signup. Useful when a team
  // shares one install on a local network. Ignored when
  // AUTH_ALLOWED_EMAIL_DOMAIN is set (the SSO domain restriction takes
  // precedence). Default off → only the first account can be created
  // from the browser (bootstrap), then signup closes.
  AUTH_OPEN_SIGNUP: z.preprocess(
    (v) => v === '1' || v === 'true',
    z.boolean().default(false),
  ),
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
