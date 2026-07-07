/**
 * Descarga y persistencia del lobby de la Cámara de Diputadas y Diputados.
 *
 * La tabla completa (~17.900 filas) viene en el HTML de
 * listadodeaudiencias.aspx. La descargamos una vez, la parseamos con el módulo
 * puro `camara-lobby` y la guardamos con INSERT … ON CONFLICT DO NOTHING
 * (idempotente) en la misma tabla lobby_audiencias que usa InfoLobby.
 *
 * Nota: camara.cl está detrás de Cloudflare y a veces responde 403 al primer
 * intento; reintentamos con espera.
 */
import { db } from '~/db';
import { lobbyAudiencias } from '~/db/schema';
import { CAMARA_LISTADO_URL, parseCamaraAudiencias } from './camara-lobby';
import type { SyncLobbyResult } from './infolobby-service';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Descarga el HTML del listado, reintentando ante 403 (Cloudflare). */
async function fetchCamaraHtml(attempts = 4): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(CAMARA_LISTADO_URL, {
        headers: { Accept: 'text/html,*/*', 'User-Agent': UA },
        signal: AbortSignal.timeout(90000),
      });
      if (res.status === 403) {
        if (i < attempts - 1) await sleep(1500 * (i + 1));
        continue;
      }
      if (!res.ok) {
        console.warn(`[Cámara] HTTP ${res.status} al descargar el listado`);
        return null;
      }
      const html = await res.text();
      // Debe traer la tabla (muchos <tr>); si no, no sirve.
      if ((html.match(/<tr[\s>]/gi) || []).length > 1) return html;
    } catch (error) {
      console.warn('[Cámara] Falló la descarga:', error instanceof Error ? error.message : String(error));
      if (i < attempts - 1) await sleep(1500 * (i + 1));
    }
  }
  return null;
}

/**
 * Sincroniza el lobby de la Cámara. Devuelve el mismo shape que InfoLobby para
 * poder sumar resultados. Si la descarga falla (p. ej. Cloudflare persistente),
 * NO lanza: registra errores=0 y fetched=0 para que el resto del sync continúe.
 */
export async function syncLobbyFromCamara(options: {
  months?: number
  verbose?: boolean
} = {}): Promise<SyncLobbyResult> {
  const { months = 24, verbose = false } = options;
  const result: SyncLobbyResult = { inserted: 0, skipped: 0, errors: 0, fetched: 0 };

  if (verbose) console.log('[Cámara] Descargando listado de audiencias…');
  const html = await fetchCamaraHtml();
  if (html === null) {
    console.warn('[Cámara] No se pudo descargar el listado (posible bloqueo de Cloudflare). Se omite esta fuente.');
    return result;
  }

  const rows = parseCamaraAudiencias(html, months);
  result.fetched = rows.length;
  if (verbose) console.log(`[Cámara] ${rows.length} audiencias en los últimos ${months} meses`);
  if (rows.length === 0) return result;

  const BATCH_SIZE = 100;
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE);
    try {
      const insertedRows = await db
        .insert(lobbyAudiencias)
        .values(batch)
        .onConflictDoNothing()
        .returning({ id: lobbyAudiencias.id });
      result.inserted += insertedRows.length;
      result.skipped += batch.length - insertedRows.length;
    } catch (error) {
      console.error('[Cámara] Error al insertar:', error instanceof Error ? error.message : String(error));
      result.errors += batch.length;
    }
  }

  if (verbose) {
    console.log(`[Cámara] Sync completo — insertadas: ${result.inserted}, existentes: ${result.skipped}, errores: ${result.errors}`);
  }
  return result;
}
