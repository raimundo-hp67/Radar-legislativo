/**
 * Wait until Postgres accepts connections (used by setup.sh).
 * Exits 0 when ready, 1 after ~30s of retries.
 */
import postgres from 'postgres';

const url = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/postgres';

for (let attempt = 1; attempt <= 30; attempt++) {
  const sql = postgres(url, { connect_timeout: 2, max: 1 });
  try {
    await sql`select 1`;
    await sql.end();
    process.exit(0);
  } catch {
    await sql.end({ timeout: 1 }).catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

console.error('No se pudo conectar a Postgres después de 30 segundos.');
process.exit(1);
