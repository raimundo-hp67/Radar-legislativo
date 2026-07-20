/**
 * Descarga y persistencia del lobby del SENADO.
 *
 * La API (ver senado-lobby.ts) entrega ~800 páginas de 10 registros, sin
 * filtros de fecha y con orden no estrictamente cronológico. Estrategia:
 *
 *  - Recorremos páginas desde la 1 insertando con ON CONFLICT DO NOTHING
 *    (dedupe por infolobby_id = "senado:<id>").
 *  - Guardamos solo audiencias cuya fecha cae en la ventana de `months`.
 *  - CORTE ADAPTATIVO: como el orden es incierto, en vez de cortar por fecha
 *    cortamos cuando llevamos muchas páginas seguidas sin insertar nada nuevo
 *    (ya entramos en territorio conocido de una corrida anterior). En la
 *    primera corrida eso implica recorrer todo el histórico una única vez.
 *  - Tope duro de páginas por si la API creciera sin control.
 *
 * Igual que la Cámara: NUNCA lanza; si la fuente falla, devuelve ceros y el
 * resto del sync continúa.
 */
import { eq, sql } from 'drizzle-orm';
import { db } from '~/db';
import { lobbyAudiencias, syncState } from '~/db/schema';
import type { NewLobbyAudiencia } from '~/db/schema';
import {
  SENADO_AUDIENCIAS_URL,
  parseSenadoPage,
  toLobbyAudiencia,
  isWithinMonths,
} from './senado-lobby';
import type { SyncLobbyResult } from './infolobby-service';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

// Con este número de páginas consecutivas sin inserciones nuevas asumimos que
// el resto ya está en la base (corridas anteriores) y cortamos.
const NO_NEW_STREAK_LIMIT = 30;
// Tope duro absoluto (la API reporta ~795 páginas hoy; margen amplio).
const HARD_MAX_PAGES = 1200;
// Pausa entre páginas para no golpear la API.
const PAGE_DELAY_MS = 250;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Marcador en sync_state: existe solo cuando una corrida recorrió el
// histórico completo SIN errores. Si la primera carga se interrumpe
// (Ctrl+C, corte de luz), quedan filas parciales pero el marcador no,
// y la siguiente corrida vuelve a recorrer todo — sin hoyos.
const FULL_SCAN_KEY = 'senado_lobby_full_scan';

async function fetchSenadoPage(page: number, attempts = 3): Promise<unknown | null> {
  const url = `${SENADO_AUDIENCIAS_URL}?per_page=10&page=${page}`;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': UA },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) {
        if (i < attempts - 1) {
          await sleep(1000 * (i + 1));
          continue;
        }
        console.warn(`[Senado] HTTP ${res.status} en la página ${page}`);
        return null;
      }
      return await res.json();
    } catch (error) {
      if (i < attempts - 1) {
        await sleep(1000 * (i + 1));
        continue;
      }
      console.warn('[Senado] Falló la descarga:', error instanceof Error ? error.message : String(error));
    }
  }
  return null;
}

/**
 * Sincroniza el lobby del Senado. Mismo shape de resultado que las demás
 * fuentes para poder sumar totales.
 */
export async function syncLobbyFromSenado(options: {
  months?: number
  verbose?: boolean
} = {}): Promise<SyncLobbyResult> {
  const { months = 24, verbose = false } = options;
  const result: SyncLobbyResult = { inserted: 0, skipped: 0, errors: 0, fetched: 0 };

  if (verbose) console.log('[Senado] Descargando audiencias desde la API de transparencia…');

  const firstJson = await fetchSenadoPage(1);
  const firstPage = firstJson ? parseSenadoPage(firstJson) : null;
  if (!firstPage) {
    console.warn('[Senado] La API no respondió con el formato esperado. Se omite esta fuente.');
    return result;
  }

  const lastPage = Math.min(firstPage.lastPage, HARD_MAX_PAGES);
  if (verbose) console.log(`[Senado] ${firstPage.total} registros históricos en ${firstPage.lastPage} páginas`);

  // Mientras NO exista el marcador de "histórico completo" en sync_state,
  // recorremos TODO sin corte adaptativo — el orden de la API no es
  // cronológico y un corte temprano dejaría hoyos. Contar filas no sirve
  // como señal (una carga interrumpida deja filas parciales); el marcador
  // solo se escribe cuando una corrida terminó el recorrido sin errores.
  const [marker] = await db
    .select({ key: syncState.key })
    .from(syncState)
    .where(eq(syncState.key, FULL_SCAN_KEY));
  const streakLimit = marker ? NO_NEW_STREAK_LIMIT : Number.POSITIVE_INFINITY;
  if (verbose && !marker) {
    console.log('[Senado] Carga completa del histórico (se hace una sola vez; si se interrumpe, la próxima corrida la retoma desde cero).');
  }

  let noNewStreak = 0;
  let cutEarly = false;

  for (let page = 1; page <= lastPage; page++) {
    const json = page === 1 ? firstJson : await fetchSenadoPage(page);
    const parsed = json ? parseSenadoPage(json) : null;
    if (!parsed) {
      // Una página caída no aborta el resto (la siguiente puede responder).
      result.errors += 1;
      continue;
    }

    result.fetched = (result.fetched ?? 0) + parsed.records.length;

    const rows = parsed.records
      .map((raw) => toLobbyAudiencia(raw))
      .filter((row): row is NewLobbyAudiencia => row !== null && isWithinMonths(row.fecha ?? null, months));

    let insertedInPage = 0;
    if (rows.length > 0) {
      try {
        const insertedRows = await db
          .insert(lobbyAudiencias)
          .values(rows)
          .onConflictDoNothing()
          .returning({ id: lobbyAudiencias.id });
        insertedInPage = insertedRows.length;
        result.inserted += insertedRows.length;
        result.skipped += rows.length - insertedRows.length;
      } catch (error) {
        console.error('[Senado] Error al insertar:', error instanceof Error ? error.message : String(error));
        result.errors += rows.length;
      }
    }

    noNewStreak = insertedInPage > 0 ? 0 : noNewStreak + 1;
    if (noNewStreak >= streakLimit) {
      if (verbose) {
        console.log(`[Senado] ${streakLimit} páginas seguidas sin registros nuevos — corte en la página ${page}/${lastPage}.`);
      }
      cutEarly = true;
      break;
    }

    if (verbose && page % 50 === 0) {
      console.log(`[Senado] Página ${page}/${lastPage} — ${result.inserted} nuevas hasta ahora`);
    }

    if (page < lastPage) await sleep(PAGE_DELAY_MS);
  }

  // El marcador de histórico completo se escribe solo si el recorrido llegó
  // al final (sin corte adaptativo) y sin páginas caídas: con errores podría
  // haber hoyos, y preferimos repetir el recorrido en la próxima corrida.
  if (!marker && !cutEarly && result.errors === 0) {
    try {
      await db
        .insert(syncState)
        .values({ key: FULL_SCAN_KEY, value: new Date().toISOString() })
        .onConflictDoUpdate({
          target: syncState.key,
          set: { value: new Date().toISOString(), updatedAt: sql`now()` },
        });
      if (verbose) console.log('[Senado] Histórico completo cargado ✓ (las próximas corridas serán incrementales y rápidas).');
    } catch (error) {
      console.warn('[Senado] No se pudo guardar el marcador de carga completa:', error instanceof Error ? error.message : String(error));
    }
  }

  if (verbose) {
    console.log(`[Senado] Sync completo — insertadas: ${result.inserted}, existentes: ${result.skipped}, errores: ${result.errors}`);
  }
  return result;
}
