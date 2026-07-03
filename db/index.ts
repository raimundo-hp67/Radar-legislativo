import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '~/config/env';
import * as schema from './schema';

// Transaction-mode poolers (Neon "-pooler", Supabase/Supavisor, pgbouncer)
// don't support prepared statements across requests.
const isPooled = /-pooler\.|pooler\.supabase|pgbouncer/i.test(env.DATABASE_URL);

const client = postgres(env.DATABASE_URL, { prepare: !isPooled });

export const db = drizzle(client, { schema });
