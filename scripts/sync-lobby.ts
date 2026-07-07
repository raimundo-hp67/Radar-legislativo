/**
 * Sincroniza audiencias de lobby desde TODAS las fuentes disponibles hacia la
 * misma base de datos:
 *   - Gobierno / servicios públicos: API oficial de Ley de Lobby si hay
 *     LEYLOBBY_API_KEY + LEYLOBBY_INSTITUCIONES; si no, el feed público de
 *     InfoLobby (~54k audiencias).
 *   - Cámara de Diputadas y Diputados: tabla pública de camara.cl.
 *   (El Senado se sumará al confirmar el formato de su API.)
 *
 * Es idempotente (upserts): puedes correrlo cuantas veces quieras.
 * Es lo mismo que hace el botón "Sincronizar Lobby" de la app.
 *
 * Uso:
 *   bun run scripts/sync-lobby.ts               # últimos 2 meses
 *   bun run scripts/sync-lobby.ts --months 6    # últimos 6 meses
 */
import { syncLobby } from '../lib/legal/infolobby-service';

const monthsFlag = process.argv.indexOf('--months');
const months = monthsFlag !== -1 ? Number(process.argv[monthsFlag + 1]) : 2;

if (!Number.isFinite(months) || months < 1 || months > 24) {
  console.error('Uso: bun run scripts/sync-lobby.ts [--months N]  (N entre 1 y 24)');
  process.exit(1);
}

console.log(`Sincronizando audiencias de lobby (últimos ${months} meses)…`);

const result = await syncLobby({ months, verbose: true });

console.log(`\n✅ Sync completado — ${result.inserted} nuevas, ${result.skipped} ya existentes${result.errors > 0 ? `, ${result.errors} errores` : ''}`);
process.exit(result.errors > 0 && result.inserted === 0 ? 1 : 0);
