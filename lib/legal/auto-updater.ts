import { env } from '~/config/env';
import { runPoll, getLastPollDate } from '~/lib/legal/poll-runner';
import { syncLobby } from '~/lib/legal/infolobby-service';
import { syncRecentProjects, syncNewBoletines } from '~/lib/legal/project-cache-sync';

// Re-check twice per hour; actual work only happens when the configured
// interval has elapsed since the last update.
const TICK_MS = 30 * 60_000;
// Let the server finish booting before the first check.
const STARTUP_DELAY_MS = 2 * 60_000;

declare global {
  // Survives HMR / duplicate register() calls within the same process.

  var __radarAutoUpdaterStarted: boolean | undefined;
}

/**
 * Built-in scheduler: while the app is running, it refreshes tracked bill
 * projects, lobby audiencias and the bill catalog every
 * AUTO_UPDATE_INTERVAL_HOURS hours (0 disables it).
 *
 * The bill poll is gated on the newest snapshot in the database, so
 * restarting the app doesn't re-poll if data is already fresh. Slack digests
 * are only sent when something actually changed ('changes-only'); HIGH
 * priority alerts always go out.
 */
export function startAutoUpdater(): void {
  const hours = env.AUTO_UPDATE_INTERVAL_HOURS;
  if (!hours) {
    console.log('[auto-update] Desactivado (AUTO_UPDATE_INTERVAL_HOURS=0)');
    return;
  }
  if (globalThis.__radarAutoUpdaterStarted) return;
  globalThis.__radarAutoUpdaterStarted = true;

  const intervalMs = hours * 3_600_000;
  let lastLobbySyncAt = 0;
  let lastCacheSyncAt = 0;
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const lastPoll = await getLastPollDate();
      if (Date.now() - (lastPoll?.getTime() ?? 0) >= intervalMs) {
        console.log('[auto-update] Actualizando proyectos de ley desde el Senado…');
        const summary = await runPoll({ digestMode: 'changes-only' });
        console.log(`[auto-update] Proyectos: ${summary.polled} consultados, ${summary.withChanges} con cambios`);
      }

      if (Date.now() - lastLobbySyncAt >= intervalMs) {
        lastLobbySyncAt = Date.now();
        console.log('[auto-update] Sincronizando audiencias de lobby…');
        const result = await syncLobby({ months: 2 });
        console.log(`[auto-update] Lobby: ${result.inserted} nuevas, ${result.skipped} existentes`);
      }

      if (Date.now() - lastCacheSyncAt >= intervalMs) {
        lastCacheSyncAt = Date.now();
        console.log('[auto-update] Actualizando catálogo de boletines (buscador)…');
        const cache = await syncRecentProjects();
        const nuevos = await syncNewBoletines();
        console.log(
          `[auto-update] Catálogo: ${cache.inserted + nuevos.inserted} nuevos, `
          + `${cache.updated + nuevos.updated} actualizados`,
        );
      }
    } catch (error) {
      console.error('[auto-update] Error:', error instanceof Error ? error.message : error);
    } finally {
      running = false;
    }
  };

  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), TICK_MS);
  }, STARTUP_DELAY_MS);

  console.log(
    `[auto-update] Activado: los datos se refrescan cada ${hours}h mientras la app esté corriendo `
    + '(configurable con AUTO_UPDATE_INTERVAL_HOURS en .env; 0 para desactivar)',
  );
}
