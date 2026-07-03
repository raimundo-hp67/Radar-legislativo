# Radar Legislativo

Seguimiento de **proyectos de ley del Congreso de Chile** y **audiencias de lobby** (Ley 20.730), con detección de cambios, alertas a Slack y agentes de análisis con IA.

## Empezar en 3 pasos

Solo necesitas [Bun](https://bun.sh/docs/installation) y [Docker Desktop](https://docs.docker.com/get-docker/) instalados. **No se necesita ninguna API key** para partir.

```bash
git clone https://github.com/raimundo-hp67/Radar-legislativo.git
cd Radar-legislativo
./scripts/setup.sh
```

El instalador hace todo solo: inicia la base de datos, crea la configuración, aplica migraciones, **te pide crear tu usuario** y ofrece cargar proyectos de ley de ejemplo. Al terminar:

```bash
bun run dev
```

Abre http://localhost:3000, inicia sesión con el usuario que creaste, y listo.

> 💡 Si usas un agente de código (Claude Code, Codex, Cursor), basta con pedirle *"levanta el proyecto y créame un usuario"* — el repo incluye `CLAUDE.md`/`AGENTS.md` con todo el contexto que necesita.

## Funcionalidades

- **Radar legislativo**: seguimiento de proyectos de ley por boletín, con estado, etapa, urgencia, comisión y detección automática de cambios (snapshots + diff).
- **Lobby**: sincronización de audiencias de lobby desde la API oficial de [Ley de Lobby](https://www.leylobby.gob.cl) (o el feed público de InfoLobby como fallback), explorador, analytics y cruce con proyectos de ley.
- **Alertas**: notificaciones a Slack ante cambios en proyectos de alta prioridad y nuevas audiencias en instituciones clave, más un resumen semanal.
- **Investigación**: agentes de chat (OpenAI) para analizar proyectos y audiencias en lenguaje natural.

## Stack

Next.js 16 (Pages Router) · TypeScript · Bun · PostgreSQL + Drizzle ORM · Tailwind CSS v4 + shadcn/ui · BetterAuth

📐 **[ARCHITECTURE.md](./ARCHITECTURE.md)** explica cómo funciona todo: diagramas, flujos de datos, mapa del código y la guía de uso paso a paso (incluyendo cómo operarlo con un agente tipo Claude Code / Codex).

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
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` + `AUTH_ALLOWED_EMAIL_DOMAIN` | Login con Google (SSO) — mejora de seguridad **totalmente opcional** | Ver [Google SSO (opcional)](#google-sso-opcional) |

Si una variable opcional no está configurada, la funcionalidad asociada simplemente se desactiva (la app avisa, no falla).

---

## Gestión de usuarios

El registro abierto está deshabilitado por diseño: las cuentas se crean por ti, con el script de usuarios. Es lo único que necesitas para ti y tu equipo:

```bash
bun run scripts/create-user.ts colega@email.com 'una-clave-segura' 'Nombre Colega'
```

(El instalador `setup.sh` ya te crea el primero.)

### Google SSO (opcional)

Si además quieres que la gente de tu organización entre con su cuenta de Google —sin contraseñas y con auto-registro para tu dominio— puedes activar SSO. **No es un requisito**: si no tienes permisos para crear credenciales OAuth en tu Google Workspace, simplemente ignora esta sección y usa el script de usuarios.

1. En [Google Cloud Console](https://console.cloud.google.com/apis/credentials) crea un proyecto y ve a **APIs & Services → Credentials → Create Credentials → OAuth client ID**, tipo **Web application**.
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
- **Login**: los endpoints de BetterAuth tienen su propio rate limit (20 req/min) contra fuerza bruta. El registro abierto está deshabilitado; las cuentas se crean con `scripts/create-user.ts` o, si activas el SSO opcional, vía Google (emails verificados) solo para el dominio de `AUTH_ALLOWED_EMAIL_DOMAIN`.
- **Crons y polling fail-closed**: en producción, `/api/cron/*` rechaza todo si `CRON_SECRET` no está configurado, y `/api/legal/poll` rechaza la API key por defecto (`change-me-in-production`). Las comparaciones de secretos son en tiempo constante.

## Fuentes de datos

- [Senado de Chile — tramitación de proyectos](https://tramitacion.senado.cl) (API XML pública, sin key)
- [Ley de Lobby](https://www.leylobby.gob.cl) (API oficial, con key) / [InfoLobby](https://www.infolobby.cl) (feed público, sin key)

## Licencia

MIT — ver [LICENSE](./LICENSE).
