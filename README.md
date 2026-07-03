# Radar Legislativo

Seguimiento de **proyectos de ley del Congreso de Chile** y **audiencias de lobby** (Ley 20.730), con detección de cambios, alertas a Slack y agentes de análisis con IA.

## Funcionalidades

- **Radar legislativo**: seguimiento de proyectos de ley por boletín, con estado, etapa, urgencia, comisión y detección automática de cambios (snapshots + diff).
- **Lobby**: sincronización de audiencias de lobby desde la API oficial de [Ley de Lobby](https://www.leylobby.gob.cl) (o InfoLobby como fallback), explorador, analytics y cruce con proyectos de ley.
- **Alertas**: notificaciones a Slack ante cambios en proyectos de alta prioridad y nuevas audiencias en instituciones clave, más un resumen semanal.
- **Investigación**: agentes de chat (OpenAI) para analizar proyectos y audiencias con lenguaje natural.
- **Cron jobs**: polling semanal automático vía Vercel Cron (`vercel.json`).

## Stack

- Next.js 16 (Pages Router) + TypeScript
- Bun como runtime
- PostgreSQL (Docker) + Drizzle ORM
- Tailwind CSS v4 + shadcn/ui
- BetterAuth para autenticación

## Requisitos previos

0. Instala [Bun](https://bun.sh/docs/installation)
1. Instala [Docker](https://docs.docker.com/get-docker/) (incluye Docker Compose)

## Ejecutar en local

1. Inicia Postgres:

```bash
docker compose up
```

2. Instala dependencias y aplica migraciones:

```bash
bun install
cp .env.example .env   # completa BETTER_AUTH_SECRET (mínimo 32 caracteres)
bun run db:migrate
```

3. Inicia el servidor de desarrollo:

```bash
bun run dev
```

4. Abre http://localhost:3000

## Configuración (`.env`)

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Postgres. Por defecto apunta al contenedor local. |
| `BETTER_AUTH_SECRET` | Secreto de autenticación (requerido, ≥32 caracteres). |
| `BETTER_AUTH_URL` | URL base de la app. |
| `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN` | Opcional: dominio de email permitido para registro. |
| `SLACK_WEBHOOK_URL` | Opcional: webhook para alertas y resumen semanal. |
| `LEGAL_POLL_API_KEY` | API key para el endpoint de polling manual (`/api/legal/poll`). |
| `CRON_SECRET` | Secreto de Vercel Cron. |
| `OPENAI_API_KEY` | Opcional: habilita los agentes de análisis con IA. |
| `LEYLOBBY_API_KEY` | Opcional: API oficial de Ley de Lobby como fuente primaria. |
| `LEYLOBBY_INSTITUCIONES` | Códigos de institución a sincronizar (ej: `AI060,AE001`). |

**Nota:** por defecto los registros de usuarios nuevos están deshabilitados (`SIGNUPS_DISABLED` en `lib/auth.ts`). Cambia ese flag para permitir registro.

## Scripts útiles

```bash
bun run scripts/seed-proyectos.ts      # Seed de proyectos de ley de ejemplo
bun run scripts/sync-lobby.ts          # Sincronizar audiencias de lobby
bun run scripts/bulk-sync.ts           # Poblar cache de proyectos del Senado
bun run db:studio                      # UI de la base de datos
```

## Fuentes de datos

- [Senado de Chile — tramitación de proyectos](https://tramitacion.senado.cl) (API XML pública)
- [Ley de Lobby](https://www.leylobby.gob.cl) / [InfoLobby](https://www.infolobby.cl) (audiencias Ley 20.730)

## Licencia

MIT — ver [LICENSE](./LICENSE).
