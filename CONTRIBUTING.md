# Contribuir a Radar Legislativo

¡Gracias por el interés! Este es un proyecto pequeño; el proceso también lo es.

## Preparar el entorno

```bash
git clone https://github.com/raimundo-hp67/Radar-legislativo.git
cd Radar-legislativo
./scripts/setup.sh   # deja base de datos + config + usuario listos
bun run dev
```

Requisitos: [Bun](https://bun.sh) y [Docker Desktop](https://docs.docker.com/get-docker/). Detalles en [docs/INSTALACION.md](./docs/INSTALACION.md); arquitectura y mapa del código en [ARCHITECTURE.md](./ARCHITECTURE.md); convenciones para agentes de código en [AGENTS.md](./AGENTS.md).

## Antes de abrir un PR

El CI corre esto mismo; ahórrate la vuelta:

```bash
bun run lint        # ESLint
bun run typecheck   # TypeScript estricto
bun test            # tests unitarios
bun run build       # build de producción
```

## Convenciones

- **Stack**: Next.js 16 Pages Router, TypeScript estricto, Tailwind v4 + shadcn/ui, Drizzle ORM. Imports con alias `~/`.
- **Endpoints**: todo endpoint de datos usa `protectedHandler` (sesión + rate limit). Ver AGENTS.md.
- **Base de datos**: los cambios de schema van en `db/schema/`, luego `bun run db:generate` + `bun run db:migrate` (commitea la migración generada).
- **Lo temático es configurable**: keywords, instituciones vigiladas y preguntas sugeridas viven en `config/radar.config.ts` — no hardcodees temas en `lib/` ni en componentes.
- **Idioma**: la UI y la documentación de usuario están en español (Chile); el código y sus comentarios en inglés está bien.

## Reportar bugs o proponer ideas

Abre un issue con pasos para reproducir (bugs) o el problema que quieres resolver (ideas). Para vulnerabilidades de seguridad usa el canal privado de [SECURITY.md](./SECURITY.md), no un issue.
