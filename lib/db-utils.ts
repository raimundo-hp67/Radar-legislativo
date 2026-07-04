/**
 * Transaction-mode poolers (Neon "-pooler", Supabase/Supavisor, pgbouncer)
 * don't support prepared statements across requests, so postgres.js must be
 * configured with prepare: false when the connection string points to one.
 */
export function isPooledConnectionString(url: string): boolean {
  return /-pooler\.|pooler\.supabase|pgbouncer/i.test(url);
}
