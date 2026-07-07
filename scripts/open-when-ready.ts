/**
 * Espera a que el servidor de desarrollo responda en localhost y abre el
 * navegador en el landing. Pensado para correr en segundo plano junto a
 * `next dev` (lo usa setup.sh y `bun run dev:open`).
 *
 * Es best-effort: si no hay navegador (servidor headless, CI, contenedor)
 * simplemente no hace nada y termina sin error — nunca rompe el arranque.
 */
import { spawn } from 'node:child_process';
import { platform } from 'node:os';

const url = process.env.APP_URL ?? 'http://localhost:3000';

async function waitForServer(timeoutMs = 90_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      // Cualquier respuesta HTTP (incluye redirect a /login) significa "listo".
      await fetch(url, { signal: AbortSignal.timeout(2000) });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return false;
}

function openBrowser(target: string): void {
  const os = platform();
  const cmd = os === 'darwin' ? 'open' : os === 'win32' ? 'cmd' : 'xdg-open';
  const args = os === 'win32' ? ['/c', 'start', '', target] : [target];
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.on('error', () => {}); // sin navegador disponible: ignorar
    child.unref();
  } catch {
    // Ignorar: entorno sin GUI.
  }
}

const ready = await waitForServer();
if (ready) {
  console.log(`\n🌐 Abriendo ${url} en tu navegador…`);
  openBrowser(url);
} else {
  console.log(`\nℹ️  Abre manualmente ${url} en tu navegador.`);
}
