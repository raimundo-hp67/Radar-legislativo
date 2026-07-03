# Radar Legislativo

Seguimiento de **proyectos de ley del Congreso de Chile** y **audiencias de lobby** (Ley 20.730), con detección de cambios, alertas a Slack y agentes de análisis con IA.

## Funcionalidades

- **Radar legislativo**: seguimiento de proyectos de ley por boletín, con estado, etapa, urgencia, comisión y detección automática de cambios (snapshots + diff).
- **Lobby**: sincronización de audiencias de lobby desde la API oficial de [Ley de Lobby](https://www.leylobby.gob.cl) (o el feed público de InfoLobby como fallback), explorador, analytics y cruce con proyectos de ley.
- **Alertas**: notificaciones a Slack ante cambios en proyectos de alta prioridad y nuevas audiencias en instituciones clave, más un resumen semanal.
- **Investigación**: agentes de chat (OpenAI) para analizar proyectos y audiencias en lenguaje natural.

## Stack

Next.js 16 (Pages Router) · TypeScript · Bun · PostgreSQL + Drizzle ORM · Tailwind CSS v4 + shadcn/ui · BetterAuth

---

## Qué se necesita para que funcione

### Requisitos mínimos (sin ninguna API key)

Lo único indispensable es **Postgres** y un **secreto de sesión**. Con eso ya funciona: el tracking de proyectos usa la **API XML pública del Senado** (no requiere key) y el lobby usa el **feed público de InfoLobby** (tampoco requiere key).

| Variable | Requerida | Para qué |
|----------|-----------|----------|
| `DATABASE_URL` | ✅ (tiene default local) | Conexión a Postgres |
| `BETTER_AUTH_SECRET` | ✅ | Sesiones de usuarios (mín. 32 caracteres) |
| `BETTER_AUTH_URL` | ✅ (default `http://localhost:3000`) | URL base de la app |

### Conexiones opcionales (habilitan funcionalidades extra)

| Variable | Habilita | Cómo obtenerla |
|----------|----------|----------------|
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Login con Google (SSO) | Ver [Configurar Google SSO](#configurar-google-sso) |
| `AUTH_ALLOWED_EMAIL_DOMAIN` | Auto-registro vía SSO para un dominio (ej: `tuempresa.com`) | Es tu propio dominio de Google Workspace |
| `SLACK_WEBHOOK_URL` | Alertas y resumen semanal en Slack | Crea un [Incoming Webhook](https://api.slack.com/messaging/webhooks) en tu workspace de Slack |
| `OPENAI_API_KEY` | Chats de análisis con IA (Proyectos, Investigación y Lobby) | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `LEYLOBBY_API_KEY` + `LEYLOBBY_INSTITUCIONES` | Fuente oficial de Ley de Lobby (en vez del feed público de InfoLobby) | Solicita una key en el [portal de Ley de Lobby](https://www.leylobby.gob.cl); en `LEYLOBBY_INSTITUCIONES` pon los códigos de institución separados por coma (ej: `AI060,AE001`) |
| `LEGAL_POLL_API_KEY` | Protege `/api/legal/poll` (polling manual vía curl o cron externo) | Inventa un string aleatorio |
| `CRON_SECRET` | Protege `/api/cron/*` en Vercel | Solo deploy en Vercel: defínelo en el dashboard del proyecto y Vercel lo envía automáticamente |

Si una variable opcional no está configurada, la funcionalidad asociada simplemente se desactiva (la app avisa, no falla).

---

## Ejecutar en local

Requisitos: [Bun](https://bun.sh/docs/installation) y [Docker](https://docs.docker.com/get-docker/).

```bash
# 1. Postgres
docker compose up -d

# 2. Setup automático (crea .env con secreto generado, instala deps y migra)
./scripts/setup.sh

# 3. Dev server
bun run dev
```

Abre http://localhost:3000.

> **Nota sobre cuentas:** el registro con email/contraseña está deshabilitado (los emails no se verifican, así que cualquiera podría reclamar una dirección ajena). La forma soportada de crear cuentas es **Google SSO con dominio permitido** (ver abajo): configura `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `AUTH_ALLOWED_EMAIL_DOMAIN`, y cada persona de tu dominio queda registrada automáticamente en su primer login con Google.

### Configurar Google SSO

1. En [Google Cloud Console](https://console.cloud.google.com/apis/credentials) crea un proyecto (o usa uno existente) y ve a **APIs & Services → Credentials → Create Credentials → OAuth client ID**, tipo **Web application**.
2. En **Authorized redirect URIs** agrega:
   - Local: `http://localhost:3000/api/auth/callback/google`
   - Producción: `https://tu-dominio.com/api/auth/callback/google`
3. Copia el Client ID y Client Secret a tu `.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   AUTH_ALLOWED_EMAIL_DOMAIN=tuempresa.com
   ```
4. Reinicia la app. En `/login` aparece **"Continuar con Google"**; cualquier usuario `@tuempresa.com` entra y su cuenta se crea sola la primera vez. Usuarios de otros dominios son rechazados.

Si `AUTH_ALLOWED_EMAIL_DOMAIN` no está definido, ninguna cuenta nueva puede crearse (ni por SSO): la app queda cerrada a los usuarios ya existentes.

### Cargar datos

```bash
# Proyectos de ley de ejemplo (fintech/pagos/regulación financiera)
bun run scripts/seed-legal-projects.ts
bun run scripts/seed-proyectos.ts

# Poblar el cache de proyectos del Senado (habilita el buscador)
bun run scripts/bulk-sync.ts

# Sincronizar audiencias de lobby
bun run scripts/sync-lobby.ts
```

### Verificar conexiones

Con la app corriendo y sesión iniciada:

- `GET /api/legal/health` — estado de la base de datos (público).
- `GET /api/legal/test-scraper?boletin=17618-19` — prueba la conexión con la API del Senado.
- `POST /api/legal/test-slack` — envía una alerta de prueba al webhook de Slack.

---

## Deploy (Vercel)

1. Importa el repo en Vercel.
2. Configura las env vars: `DATABASE_URL` (ej: Neon/Supabase/RDS), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` y las opcionales que quieras.
3. Define `CRON_SECRET` para que los crons queden protegidos. `vercel.json` ya trae los dos cron jobs:
   - `/api/cron/legal-poll` — lunes 12:00 UTC (poll de proyectos + digest a Slack)
   - `/api/cron/lobby-sync` — lunes 07:00 UTC (sync de audiencias de lobby)
4. Aplica las migraciones contra tu base de producción: `DATABASE_URL=... bun run db:migrate`.

## Seguridad

- **Autenticación**: todos los endpoints de datos (`/api/legal/*`) exigen sesión (devuelven `401` sin ella). El único endpoint público es `/api/legal/health`, que solo expone conteos.
- **Rate limiting**: todos los endpoints autenticados tienen límite por usuario y ruta (100 req/min por defecto). Los endpoints caros son más estrictos: chats con IA 20 req/5 min, syncs y scrapers 5 req/10 min. Los públicos se limitan por IP (`/health` 30 req/min, `/poll` 6 req/hora). Al exceder el límite se responde `429` con header `Retry-After`. El limitador es en memoria: en serverless aplica por instancia (suficiente contra ráfagas; para límites globales estrictos usa un store compartido tipo Redis).
- **Login**: los endpoints de BetterAuth tienen su propio rate limit (20 req/min) contra fuerza bruta. El registro con email/contraseña está deshabilitado; las cuentas se crean solo vía Google SSO (emails verificados por Google) y únicamente para el dominio configurado en `AUTH_ALLOWED_EMAIL_DOMAIN`.
- **Crons y polling fail-closed**: en producción, `/api/cron/*` rechaza todo si `CRON_SECRET` no está configurado, y `/api/legal/poll` rechaza la API key por defecto (`change-me-in-production`). Las comparaciones de secretos son en tiempo constante.

## Fuentes de datos

- [Senado de Chile — tramitación de proyectos](https://tramitacion.senado.cl) (API XML pública, sin key)
- [Ley de Lobby](https://www.leylobby.gob.cl) (API oficial, con key) / [InfoLobby](https://www.infolobby.cl) (feed público, sin key)

## Licencia

MIT — ver [LICENSE](./LICENSE).
