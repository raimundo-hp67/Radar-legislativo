import { db } from '~/db';
import { lobbyAudiencias } from '~/db/schema';
import type { NewLobbyAudiencia } from '~/db/schema';
import { isLeyLobbyEnabled, syncLobbyFromLeyLobby } from './leylobby-service';
import { parseAudienciasCsv } from './infolobby-csv';
import { syncLobbyFromCamara } from './camara-service';

/**
 * InfoLobby Service
 *
 * Attempts to fetch lobby activities from InfoLobby API.
 * InfoLobby provides data on lobbying activities in Chile as mandated by Law Nº 20.730.
 *
 * Note: InfoLobby's search is JavaScript-based, so we can't easily scrape it.
 * We use their VirtuosoLobby API endpoints where possible.
 *
 * Website: https://www.infolobby.cl
 */

const INFOLOBBY_BASE = 'https://www.infolobby.cl';
const SPARQL_ENDPOINT = 'http://datos.infolobby.cl/sparql';

export interface InfoLobbyAudiencia {
  id: string
  fecha: string
  sujetoPasivo: string
  sujetoPasivoInstitucion: string
  sujetoActivo: string
  sujetoActivoTipo: string
  tipoAudiencia: string
  lugar: string
  materia: string
  forma: string
  url: string
}

/**
 * Generate search terms from project title
 */
function generateSearchTerms(projectTitle: string, boletin: string): string[] {
  const terms: string[] = [];

  // Add full title (cleaned)
  const cleanTitle = projectTitle
    .replace(/[^\w\sáéíóúñÁÉÍÓÚÑ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanTitle.length > 5) {
    terms.push(cleanTitle);
  }

  // Extract meaningful words (longer than 4 chars, not stop words)
  const stopWords = ['para', 'como', 'sobre', 'entre', 'desde', 'hasta', 'mediante', 'través', 'forma', 'otras', 'materias', 'proyecto', 'regula'];
  const words = cleanTitle.split(' ')
    .filter((w) => w.length > 4 && !stopWords.includes(w.toLowerCase()));

  // Add key words
  words.slice(0, 3).forEach((word) => {
    if (word.length > 4) terms.push(word);
  });

  // Add boletin number
  terms.push(boletin);

  return [...new Set(terms.filter((t) => t && t.length > 2))];
}

/**
 * Query SPARQL endpoint to search for audiencias
 * The endpoint accepts simple queries but may reject complex filters
 */
async function searchSparql(searchTerm: string): Promise<InfoLobbyAudiencia[]> {
  // Simple SPARQL query - more complex filters get rejected
  const query = `
    SELECT ?audiencia ?fecha ?sujetoPasivo ?institucion ?materia
    WHERE {
      ?audiencia a <http://datos.infolobby.cl/def/ley-lobby/Audiencia> .
      OPTIONAL { ?audiencia <http://datos.infolobby.cl/def/ley-lobby/fecha> ?fecha }
      OPTIONAL { ?audiencia <http://www.w3.org/2000/01/rdf-schema#label> ?sujetoPasivo }
      OPTIONAL { ?audiencia <http://datos.infolobby.cl/def/ley-lobby/institucion> ?institucion }
      OPTIONAL { ?audiencia <http://datos.infolobby.cl/def/ley-lobby/materia> ?materia }
    }
    LIMIT 50
  `;

  try {
    const response = await fetch(SPARQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/sparql-results+json',
        'User-Agent': 'Mozilla/5.0 (compatible; RadarLegislativo/1.0)',
      },
      body: `query=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.warn(`[InfoLobby] SPARQL returned ${response.status}`);
      return [];
    }

    const data = await response.json() as {
      results?: {
        bindings?: Array<Record<string, { value: string }>>
      }
    };

    const bindings = data.results?.bindings || [];

    // Filter results that contain the search term
    const searchLower = searchTerm.toLowerCase();
    const filtered = bindings.filter((b) => {
      const materia = b.materia?.value?.toLowerCase() || '';
      const sujetoPasivo = b.sujetoPasivo?.value?.toLowerCase() || '';
      return materia.includes(searchLower) || sujetoPasivo.includes(searchLower);
    });

    return filtered.map((b, idx) => {
      const uri = b.audiencia?.value || '';
      const id = uri.split('/').pop() || `sparql-${idx}`;
      return {
        id,
        fecha: b.fecha?.value || '',
        sujetoPasivo: b.sujetoPasivo?.value || '',
        sujetoPasivoInstitucion: b.institucion?.value || '',
        sujetoActivo: '',
        sujetoActivoTipo: '',
        tipoAudiencia: 'Audiencia',
        lugar: '',
        materia: b.materia?.value || '',
        forma: '',
        url: `${INFOLOBBY_BASE}/Audiencia`,
      };
    });
  } catch (error) {
    console.warn('[InfoLobby] SPARQL query failed:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}

/**
 * Try VirtuosoLobby API endpoint - simplified to avoid timeouts
 * Only fetches current year data to keep each request short
 */
async function searchVirtuosoApi(searchTerm: string): Promise<InfoLobbyAudiencia[]> {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Only try 2 requests max to avoid timeout
  const requests = [
    { year: currentYear, month: currentMonth },
    { year: currentYear, month: 1 },
  ];

  const allResults: InfoLobbyAudiencia[] = [];

  for (const { year, month } of requests) {
    try {
      const url = `${INFOLOBBY_BASE}/VirtuosoLobby/Listado/Audiencia/1/${year}/${month}/0`;
      console.log('[InfoLobby] Fetching:', url);

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout per request
      });

      if (response.ok) {
        const data = await response.json() as Array<{
          IdLobby?: string
          Fecha?: string
          Label?: string
          Institucion?: string
          Materia?: string
          Tipo?: string
        }>;

        if (Array.isArray(data) && data.length > 0) {
          console.log(`[InfoLobby] Got ${data.length} results for ${year}/${month}`);

          const searchLower = searchTerm.toLowerCase();
          const matches = data.filter((item) => {
            const materia = item.Materia?.toLowerCase() || '';
            const label = item.Label?.toLowerCase() || '';
            return materia.includes(searchLower) || label.includes(searchLower);
          });

          allResults.push(...matches.map((item, idx) => ({
            id: item.IdLobby || `virtuoso-${year}-${month}-${idx}`,
            fecha: item.Fecha || '',
            sujetoPasivo: item.Label || '',
            sujetoPasivoInstitucion: item.Institucion || '',
            sujetoActivo: '',
            sujetoActivoTipo: '',
            tipoAudiencia: item.Tipo || 'Audiencia',
            lugar: '',
            materia: item.Materia || '',
            forma: '',
            url: `${INFOLOBBY_BASE}/Audiencia`,
          })));
        }
      }
    } catch (error) {
      console.warn(`[InfoLobby] VirtuosoLobby failed:`, error instanceof Error ? error.message : 'Unknown');
    }
  }

  return allResults;
}

/**
 * Deduplicate audiencias
 */
function deduplicateAudiencias(audiencias: InfoLobbyAudiencia[]): InfoLobbyAudiencia[] {
  const seen = new Map<string, InfoLobbyAudiencia>();

  for (const a of audiencias) {
    const key = `${a.fecha}-${a.sujetoPasivo}-${a.sujetoPasivoInstitucion}`.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, a);
    }
  }

  return Array.from(seen.values());
}

/**
 * Sort audiencias by date (most recent first)
 */
function sortAudienciasByDate(audiencias: InfoLobbyAudiencia[]): InfoLobbyAudiencia[] {
  return audiencias.sort((a, b) => {
    const dateA = a.fecha ? new Date(a.fecha).getTime() : 0;
    const dateB = b.fecha ? new Date(b.fecha).getTime() : 0;
    return dateB - dateA;
  });
}

/**
 * Convert InfoLobbyAudiencia to database format
 */
export function toDbLobbyAudiencia(
  audiencia: InfoLobbyAudiencia,
  _boletin: string,
  _projectId?: number,
): NewLobbyAudiencia {
  return {
    infolobbyId: audiencia.id || 'unknown',
    fecha: audiencia.fecha || null,
    sujetoPasivo: audiencia.sujetoPasivo || null,
    sujetoPasivoInstitucion: audiencia.sujetoPasivoInstitucion || null,
    sujetoActivo: audiencia.sujetoActivo || null,
    sujetoActivoTipo: audiencia.sujetoActivoTipo || null,
    tipoAudiencia: audiencia.tipoAudiencia || null,
    lugar: audiencia.lugar || null,
    materia: audiencia.materia || null,
    forma: audiencia.forma || null,
    sourceUrl: audiencia.url || null,
  };
}

/**
 * Generate a direct search link to InfoLobby
 */
export function getInfoLobbySearchLink(projectTitle: string): string {
  return `${INFOLOBBY_BASE}/?q=${encodeURIComponent(projectTitle)}`;
}

/**
 * Search for audiencias using multiple methods
 * Kept short and bounded (~10s) so UI calls stay responsive
 */
export async function fetchAndPrepareAudiencias(
  boletin: string,
  projectTitle: string,
  projectId?: number,
): Promise<NewLobbyAudiencia[]> {
  console.log(`[InfoLobby] Fetching audiencias for: ${projectTitle} (${boletin})`);

  // Generate search terms - only use first term to avoid timeout
  const searchTerms = generateSearchTerms(projectTitle, boletin);
  const primaryTerm = searchTerms[0] || boletin;
  console.log(`[InfoLobby] Primary search term: ${primaryTerm}`);

  const allAudiencias: InfoLobbyAudiencia[] = [];

  try {
    // Try VirtuosoLobby API with single term (faster)
    const virtuosoResults = await searchVirtuosoApi(primaryTerm);
    allAudiencias.push(...virtuosoResults);
    console.log(`[InfoLobby] VirtuosoLobby found: ${virtuosoResults.length}`);

    // Only try SPARQL if no results and we have time
    if (allAudiencias.length === 0) {
      console.log('[InfoLobby] Trying SPARQL fallback...');
      const sparqlResults = await searchSparql(primaryTerm);
      allAudiencias.push(...sparqlResults);
      console.log(`[InfoLobby] SPARQL found: ${sparqlResults.length}`);
    }
  } catch (error) {
    console.error('[InfoLobby] Search error:', error instanceof Error ? error.message : 'Unknown');
  }

  // Deduplicate and sort
  const uniqueAudiencias = deduplicateAudiencias(allAudiencias);
  const sortedAudiencias = sortAudienciasByDate(uniqueAudiencias);

  console.log(`[InfoLobby] Total unique audiencias: ${sortedAudiencias.length}`);

  // Limit to 50 most recent
  const limitedAudiencias = sortedAudiencias.slice(0, 50);

  return limitedAudiencias.map((a) => toDbLobbyAudiencia(a, boletin, projectId));
}

export interface SyncLobbyResult {
  inserted: number
  skipped: number
  errors: number
  // Registros crudos recibidos de la fuente (antes de deduplicar/insertar).
  // Distingue "la fuente no devolvió nada" (fetched 0) de "recibí datos
  // pero ninguno se pudo guardar" (fetched > 0, inserted+skipped 0).
  fetched?: number
}

/**
 * Descarga el CSV acumulativo de audiencias de InfoLobby. La URL lleva un
 * año/mes pero el archivo es el mismo dataset completo; probamos el mes
 * actual y retrocedemos si aún no está publicado. Devuelve el texto del CSV
 * o null si ningún intento respondió con datos.
 */
async function fetchLobbyCsv(now: Date = new Date()): Promise<string | null> {
  for (let i = 0; i < 4; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const url = `${INFOLOBBY_BASE}/VirtuosoLobby/Visualizacion/${year}/${month}/dataset-audiencias.csv?PeriodoVis=1`;
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok) {
        console.warn(`[InfoLobby] HTTP ${response.status} for ${url}`);
        continue;
      }
      const text = await response.text();
      // Debe traer encabezado + al menos una fila de datos.
      if (text.split(/\r?\n/).filter((l) => l.trim()).length > 1) {
        return text;
      }
    } catch (error) {
      console.warn(`[InfoLobby] Failed to fetch ${url}:`, error instanceof Error ? error.message : String(error));
    }
  }
  return null;
}

/**
 * Sync audiencias from InfoLobby's open-data CSV and persist them using
 * INSERT … ON CONFLICT DO NOTHING (idempotent). Fetches the single cumulative
 * CSV once and keeps only audiencias from the last `months` months.
 */
export async function syncLobbyFromInfoLobby(options: {
  months?: number
  verbose?: boolean
} = {}): Promise<SyncLobbyResult> {
  const { months = 6, verbose = false } = options;

  const result: SyncLobbyResult = { inserted: 0, skipped: 0, errors: 0, fetched: 0 };

  if (verbose) console.log('[InfoLobby] Descargando CSV de datos abiertos…');
  const csv = await fetchLobbyCsv();
  if (csv === null) {
    throw new Error(
      'No se pudo descargar el CSV de audiencias de InfoLobby. Revisa tu conexión o intenta más tarde.',
    );
  }

  const rows = parseAudienciasCsv(csv, months);
  result.fetched = rows.length;
  if (verbose) console.log(`[InfoLobby] ${rows.length} audiencias en los últimos ${months} meses`);
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
      console.error('[InfoLobby] DB insert error:', error instanceof Error ? error.message : String(error));
      result.errors += batch.length;
    }
  }

  if (verbose) {
    console.log(`[InfoLobby] Sync complete — inserted: ${result.inserted}, skipped: ${result.skipped}, errors: ${result.errors}`);
  }

  return result;
}

/**
 * Sync lobby audiencias from ALL available sources into the same table.
 *
 * Sources (todas escriben en lobby_audiencias con upsert idempotente):
 *   1. Gobierno / servicios públicos → API oficial Ley de Lobby si está
 *      configurada (LEYLOBBY_API_KEY + LEYLOBBY_INSTITUCIONES), o el feed
 *      público de InfoLobby en su defecto.
 *   2. Cámara de Diputadas y Diputados → tabla HTML de camara.cl.
 *
 * (El Senado se sumará cuando confirmemos el formato de su API GetReuniones.)
 *
 * Cada fuente falla de forma aislada: si una no responde, las demás igual se
 * sincronizan y sus totales se suman en el resultado.
 */
export async function syncLobby(options: {
  months?: number
  verbose?: boolean
} = {}): Promise<SyncLobbyResult> {
  const total: SyncLobbyResult = { inserted: 0, skipped: 0, errors: 0, fetched: 0 };
  const add = (r: SyncLobbyResult) => {
    total.inserted += r.inserted;
    total.skipped += r.skipped;
    total.errors += r.errors;
    total.fetched = (total.fetched ?? 0) + (r.fetched ?? 0);
  };

  // 1. Gobierno (InfoLobby o API oficial).
  try {
    if (isLeyLobbyEnabled()) {
      if (options.verbose) console.log('[Lobby] Fuente 1/2: API oficial Ley de Lobby');
      add(await syncLobbyFromLeyLobby(options));
    } else {
      if (options.verbose) console.log('[Lobby] Fuente 1/2: feed público InfoLobby');
      add(await syncLobbyFromInfoLobby(options));
    }
  } catch (error) {
    console.error('[Lobby] Falló la fuente de gobierno:', error instanceof Error ? error.message : String(error));
    total.errors += 1;
  }

  // 2. Cámara de Diputados (no lanza; se omite sola si Cloudflare bloquea).
  if (options.verbose) console.log('[Lobby] Fuente 2/2: Cámara de Diputados');
  add(await syncLobbyFromCamara(options));

  if (options.verbose) {
    console.log(`[Lobby] Total combinado — insertadas: ${total.inserted}, existentes: ${total.skipped}, errores: ${total.errors}`);
  }
  return total;
}

// Export for backward compatibility
export async function searchAudienciasByProject(
  boletin: string,
  keywords: string[] = [],
): Promise<InfoLobbyAudiencia[]> {
  const title = keywords.join(' ');
  const audiencias = await fetchAndPrepareAudiencias(boletin, title);
  return audiencias.map((a) => ({
    id: a.infolobbyId || '',
    fecha: a.fecha || '',
    sujetoPasivo: a.sujetoPasivo || '',
    sujetoPasivoInstitucion: a.sujetoPasivoInstitucion || '',
    sujetoActivo: a.sujetoActivo || '',
    sujetoActivoTipo: a.sujetoActivoTipo || '',
    tipoAudiencia: a.tipoAudiencia || '',
    lugar: a.lugar || '',
    materia: a.materia || '',
    forma: a.forma || '',
    url: a.sourceUrl || '',
  }));
}
