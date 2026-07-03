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

> **Nota sobre cuentas:** el registro de usuarios nuevos viene deshabilitado (`SIGNUPS_DISABLED` en `lib/auth.ts`). Para crear tu primer usuario, cambia ese flag a `false`, regístrate en `/signup` con un formulario propio o crea el usuario vía la API de BetterAuth, y vuelve a activarlo.

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
- **Login**: los endpoints de BetterAuth tienen su propio rate limit (20 req/min) contra fuerza bruta, y el registro de cuentas viene deshabilitado.
- **Crons y polling fail-closed**: en producción, `/api/cron/*` rechaza todo si `CRON_SECRET` no está configurado, y `/api/legal/poll` rechaza la API key por defecto (`change-me-in-production`). Las comparaciones de secretos son en tiempo constante.

## Fuentes de datos

- [Senado de Chile — tramitación de proyectos](https://tramitacion.senado.cl) (API XML pública, sin key)
- [Ley de Lobby](https://www.leylobby.gob.cl) (API oficial, con key) / [InfoLobby](https://www.infolobby.cl) (feed público, sin key)

## Licencia

MIT — ver [LICENSE](./LICENSE).
