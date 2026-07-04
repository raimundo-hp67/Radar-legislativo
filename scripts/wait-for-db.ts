/**
 * Wait until Postgres accepts connections (used by setup.sh).
 * Exits 0 when ready, 1 after ~60s of retries.
 */
import postgres from 'postgres';

const url = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/postgres';

for (let attempt = 1; attempt <= 60; attempt++) {
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

console.error('No se pudo conectar a Postgres después de 60 segundos.');
console.error('Diagnóstico:');
console.error('  - ¿Docker Desktop está abierto? Revisa el contenedor con: docker compose ps');
console.error('  - Logs de la base de datos: docker compose logs db');
console.error('  - ¿Otro Postgres usando el puerto? Cambia POSTGRES_PORT en .env');
process.exit(1);
