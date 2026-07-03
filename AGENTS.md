# AGENTS.md

## Stack

- **Framework**: Next.js 16 (Pages Router)
- **Language**: TypeScript (strict mode)
- **Runtime**: Bun
- **Styling**: Tailwind CSS v4
- **Components**: shadcn/ui (new-york style, zinc base color)
- **Icons**: lucide-react
- **Database**: PostgreSQL (Docker) + Drizzle ORM
- **Validation**: Zod

## Path Aliases

Use `~/` for imports from project root:
```ts
import { cn } from '~/lib/utils';
import { Button } from '~/components/ui/button';
```

## Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server |
| `bun run components:add <name>` | Add shadcn component |
| `docker compose up` | Start PostgreSQL database |
| `bun run lint` | Run ESLint |
| `bun run db:generate` | Generate migration from schema changes |
| `bun run db:migrate` | Apply migrations to database |
| `bun run db:studio` | Open Drizzle Studio |

## Adding shadcn Components

```bash
bun run components:add button
bun run components:add card
bun run components:add dialog
```

Components are added to `components/ui/`. Browse available components at https://ui.shadcn.com/docs/components

## Styling

- Tailwind v4 with CSS variables for theming
- Dark mode: add `dark` class to html element
- Use `cn()` helper from `~/lib/utils` for conditional classes:
  ```ts
  cn('base-class', condition && 'conditional-class')
  ```
- Color tokens: `primary`, `secondary`, `muted`, `accent`, `destructive`, `background`, `foreground`

## Environment Variables

Env variables are validated with Zod in `config/env.ts`:
```ts
import { env } from '~/config/env';

env.DATABASE_URL  // validated, defaults to local postgres
```

Add new env variables to the schema in `config/env.ts`.

- `pages/api/users.ts` → `GET /api/users`
- `pages/api/users/[id].ts` → `GET /api/users/:id`

## Data Fetching

Use TanStack Query (React Query) for frontend data fetching:

```ts
import { useQuery } from '@tanstack/react-query';
import * as z from 'zod';

const { data, isLoading } = useQuery({
  queryKey: ['users'],
  queryFn: async () => {
    const response = await fetch('/api/users');
    const data = await response.json();
    return z.array(z.object({ id: z.number(), name: z.string() })).parse(data);
  },
});
```

Docs: https://tanstack.com/query/latest/docs/framework/react/overview

## Auth (BetterAuth)

**VERY IMPORTANT: EVERY API endpoint that will be used by users of the application MUST be protected. Use `protectedHandler` for all user-facing endpoints.**

- **API Route protection**: use `protectedHandler` from `~/lib/api/protected-handler`:
  ```ts
  import type { NextApiRequest, NextApiResponse } from 'next';
  import { protectedHandler } from '~/lib/api/protected-handler';

  export default protectedHandler(async (req: NextApiRequest, res: NextApiResponse, session) => {
    // session.user available here
    return res.status(200).json({ data: 'value' });
  });
  ```
- **Pages Router protection**: protect pages using `getServerSideProps` + `requireAuth()` from `lib/ssr/require-auth.ts` (preferred; no client redirects / no flash).
- **Serialization**: use `serializeUser()` to convert `Date` fields to ISO strings for Next.js props.
- **Pattern**:
  ```ts
  import type { InferGetServerSidePropsType } from 'next';
  import { requireAuth, serializeUser } from '~/lib/ssr/require-auth';

  export const getServerSideProps = requireAuth(async (_ctx, session) => ({
    props: {
      user: serializeUser(session.user),
    },
  }));

  export default function Page(
    props: InferGetServerSidePropsType<typeof getServerSideProps>
  ) {
    // ...render protected content
  }
  ```
- **Do not** use `useEffect` redirects for page protection unless you have a specific reason.

## Database

PostgreSQL runs via Docker:
```bash
docker compose up      # Start database
docker compose down    # Stop database
```

### Drizzle ORM

Docs: https://orm.drizzle.team/llms.txt

New models go in `db/schema/<plural-model-name>.ts`, then re-export from `db/schema.ts`.

**After changing anything in `db/*`:**
1. Run `bun run db:generate` to generate migration
2. Run `bun run db:migrate` to apply migration

## Next.js

You will be using the PAGES ROUTER of Next.js.

Always check the official Next.js Pages Router docs (https://nextjs.org/docs/pages) before non-trivial framework work.

### Project Structure

```
pages/          # Next.js pages (Pages Router)
components/     # React components
components/ui/  # shadcn/ui components
config/         # Environment and app configuration
db/             # Drizzle ORM schema and connection
drizzle/        # Generated migrations
public/         # Static assets
```

### API Routes

Backend endpoints live in `pages/api/`. Each file exports a default handler function:

```ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Handle request
  return res.status(200).json({ data: 'value' });
}
```

For protected API routes, use `protectedHandler` from `~/lib/api/protected-handler`:

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { protectedHandler } from '~/lib/api/protected-handler';

export default protectedHandler(async (req: NextApiRequest, res: NextApiResponse, session) => {
  // session.user available here
  return res.status(200).json({ data: 'value' });
});
```
