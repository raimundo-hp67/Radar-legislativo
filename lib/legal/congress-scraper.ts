import type { ScrapedData } from './types';

/**
 * Fetch project status using multiple sources in order of reliability:
 * 1. Senado tracking endpoint (datos_proy + trámites HTML)
 * 2. BCN API (backup, JSON)
 * 3. Empty result (last resort)
 */
export async function fetchProjectStatus(boletin: string): Promise<ScrapedData> {
  const sourceUrl = `https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=${boletin}`;

  // Primary source: Senado details + tramites pages
  const senadoData = await fetchFromSenadoPage(boletin, sourceUrl);
  if (senadoData.stage || senadoData.lastAction || senadoData.urgency) {
    return senadoData;
  }

  // Fallback to BCN API
  const bcnData = await fetchFromBcnApi(boletin);
  if (bcnData && (bcnData.stage || bcnData.lastAction)) {
    console.log(`BCN API succeeded for ${boletin}`);
    return bcnData;
  }

  // Both sources failed: surface the failure instead of returning an empty
  // snapshot — storing all-null data would poison the diff history and
  // produce false "change detected" alerts on the next poll.
  throw new Error(
    `No se pudo obtener el estado del boletín ${boletin}: ni el Senado ni la BCN respondieron con datos`,
  );
}

/**
 * Fetch project status from the BCN (Biblioteca del Congreso Nacional) API
 */
async function fetchFromBcnApi(boletin: string): Promise<ScrapedData | null> {
  const bcnUrl = `https://www.bcn.cl/laborparlamentaria/wsapiboletin/proyecto?boletin=${boletin}`;
  const sourceUrl = `https://www.bcn.cl/historiadelaley/nc/proyecto-de-ley/${boletin}/`;

  try {
    const response = await fetch(bcnUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; RadarLegislativo/1.0)',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (response.ok) {
      let data: unknown;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.warn(`BCN API returned invalid JSON for ${boletin}:`, jsonError);
        return null;
      }

      // Validate data is a non-null object (not array)
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const record = data as Record<string, unknown>;
        return {
          boletin,
          stage: typeof record.etapa === 'string' ? record.etapa : (typeof record.estado === 'string' ? record.estado : null),
          chamberCurrent: typeof record.camara_actual === 'string' ? record.camara_actual : (typeof record.camara_origen === 'string' ? record.camara_origen : null),
          lastAction: typeof record.ultimo_tramite === 'string' ? record.ultimo_tramite : (typeof record.descripcion_tramite === 'string' ? record.descripcion_tramite : null),
          lastActionDate: formatDate(typeof record.fecha_ultimo_tramite === 'string' ? record.fecha_ultimo_tramite : (typeof record.fecha_tramite === 'string' ? record.fecha_tramite : null)),
          urgency: typeof record.urgencia === 'string' ? record.urgencia : null,
          commission: typeof record.comision === 'string' ? record.comision : null,
          sourceUrl,
        };
      }
    }
  } catch (error) {
    console.warn(`BCN API failed for ${boletin}:`, error instanceof Error ? error.message : 'Unknown error');
  }

  return null;
}

/**
 * Fallback: Scrape from Senado's public tracking page
 */
async function fetchFromSenadoPage(boletin: string, sourceUrl: string): Promise<ScrapedData> {
  const detailsUrl = `https://tramitacion.senado.cl/appsenado/index.php?mo=tramitacion&ac=datos_proy&nboletin=${encodeURIComponent(boletin)}`;

  try {
    const response = await fetch(detailsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return createEmptyResult(boletin, sourceUrl);
    }

    const html = decodeHtmlEntities(await response.text());
    const details = extractSenadoDetails(html);

    let lastAction = details.stageDetail;
    let lastActionDate: string | null = null;

    if (details.projectId) {
      const latestTramite = await fetchLatestTramite(details.projectId);
      if (latestTramite?.action) {
        lastAction = latestTramite.action;
      }
      if (latestTramite?.date) {
        lastActionDate = latestTramite.date;
      }
    }

    return {
      boletin,
      stage: details.stage,
      chamberCurrent: details.chamberCurrent || determineChamberFromBoletin(boletin),
      lastAction,
      lastActionDate,
      urgency: details.urgency,
      commission: null,
      sourceUrl: details.sourceUrl || detailsUrl,
    };
  } catch (error) {
    console.warn(`Senado scraping failed for ${boletin}:`, error instanceof Error ? error.message : 'Unknown error');
    return createEmptyResult(boletin, sourceUrl);
  }
}

type SenadoDetails = {
  stage: string | null
  stageDetail: string | null
  chamberCurrent: string | null
  urgency: string | null
  sourceUrl: string | null
  projectId: number | null
};

type SenadoTramite = {
  action: string | null
  date: string | null
};

function extractSenadoDetails(html: string): SenadoDetails {
  const rows = extractRowsFromTableByClass(html, 'table-datos');

  let stage: string | null = null;
  let stageDetail: string | null = null;
  let chamberOrigin: string | null = null;
  let urgency: string | null = null;
  let sourceUrl: string | null = null;
  let previousLabel = '';

  for (const row of rows) {
    const pairs: Array<{ label: string, value: string | null }> = [
      {
        label: normalizeLabel(row[0] ?? ''),
        value: (row[1] ?? '').trim() || null,
      },
      {
        label: normalizeLabel(row[2] ?? ''),
        value: (row[3] ?? '').trim() || null,
      },
    ];

    for (const pair of pairs) {
      const { label, value } = pair;

      if (label.includes('urgencia actual') || label === 'urgencia') {
        urgency = value;
      }

      if (label.includes('camara de origen')) {
        chamberOrigin = value;
      }

      if (label === 'etapa') {
        stage = value;
        previousLabel = label;
        continue;
      }

      // The row immediately after "Etapa" usually contains the latest substage detail.
      if (!label && previousLabel === 'etapa' && value) {
        stageDetail = value;
      }

      if (label.includes('link para compartir')) {
        sourceUrl = value?.replace(/^http:\/\//i, 'https://') ?? null;
      }

      if (label) {
        previousLabel = label;
      }
    }
  }

  const chamberFromStage = extractChamberFromStage(stage);
  const chamberCurrent = chamberFromStage || normalizeChamber(chamberOrigin);
  const projectId = extractProjectId(html);

  return {
    stage,
    stageDetail,
    chamberCurrent,
    urgency,
    sourceUrl,
    projectId,
  };
}

async function fetchLatestTramite(projectId: number): Promise<SenadoTramite | null> {
  const tramitesUrl = `https://tramitacion.senado.cl/appsenado/index.php?mo=tramitacion&ac=tramites&proyid=${projectId}`;

  try {
    const response = await fetch(tramitesUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return null;
    }

    const html = decodeHtmlEntities(await response.text());
    const rows = extractRowsFromTableById(html, 'grid_tram');

    let latest: { date: string, action: string | null } | null = null;

    for (const row of rows) {
      const rawDate = row[1] ?? '';
      const isoDate = formatDate(rawDate);
      if (!isoDate) continue;

      const action = (row[2] ?? '').trim() || null;

      if (!latest || isoDate > latest.date) {
        latest = {
          date: isoDate,
          action,
        };
      }
    }

    if (!latest) {
      return null;
    }

    return {
      action: latest.action,
      date: latest.date,
    };
  } catch (error) {
    console.warn(`Failed to fetch tramites for project ${projectId}:`, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Determine chamber from boletin number
 * Odd suffix numbers (01, 03, 05, 07, 09, 11, 13, 15, 17, 19, 21, 23) = Cámara de Diputados
 * Even suffix numbers (02, 04, 06, 08, 10, 12, 14, 16, 18, 20, 22, 24) = Senado
 */
function determineChamberFromBoletin(boletin: string): string | null {
  const match = boletin.match(/-(\d+)$/);
  if (match) {
    const suffix = parseInt(match[1], 10);
    if (suffix % 2 === 1) {
      return 'Cámara de Diputados';
    }
    return 'Senado';
  }
  return null;
}

function extractProjectId(html: string): number | null {
  const match = html.match(/\bproyid\s*=\s*(\d+)\s*;/i);
  if (!match) return null;

  const parsed = Number.parseInt(match[1], 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function extractChamberFromStage(stage: string | null): string | null {
  if (!stage) return null;

  const match = stage.match(/\(([^)]+)\)/);
  if (!match?.[1]) return null;

  return normalizeChamber(match[1]);
}

function normalizeChamber(value: string | null): string | null {
  if (!value) return null;

  const normalized = normalizeLabel(value);
  if (normalized.includes('diput')) return 'Cámara de Diputados';
  if (normalized.includes('senado')) return 'Senado';
  return value.trim();
}

function extractRowsFromTableByClass(html: string, className: string): string[][] {
  const tableRegex = new RegExp(`<table[^>]*class=["'][^"']*\\b${escapeRegExp(className)}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/table>`, 'i');
  const tableMatch = html.match(tableRegex);
  if (!tableMatch?.[1]) return [];
  return extractRowsFromTableFragment(tableMatch[1]);
}

function extractRowsFromTableById(html: string, id: string): string[][] {
  const tableRegex = new RegExp(`<table[^>]*id=["']${escapeRegExp(id)}["'][^>]*>([\\s\\S]*?)<\\/table>`, 'i');
  const tableMatch = html.match(tableRegex);
  if (!tableMatch?.[1]) return [];
  return extractRowsFromTableFragment(tableMatch[1]);
}

function extractRowsFromTableFragment(fragment: string): string[][] {
  const rows: string[][] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

  let rowMatch: RegExpExecArray | null = null;
  while ((rowMatch = rowRegex.exec(fragment)) !== null) {
    const rowHtml = rowMatch[1] ?? '';
    const cells: string[] = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

    let cellMatch: RegExpExecArray | null = null;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      const clean = normalizeWhitespace(stripHtml(cellMatch[1] ?? ''));
      cells.push(clean);
    }

    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  return rows;
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ');
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&apos;/gi, '\'')
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&ntilde;/gi, 'ñ')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&Eacute;/g, 'É')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&Ntilde;/g, 'Ñ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/:/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;

  // If already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // If in DD/MM/YYYY format
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    const [day, month, year] = parts;
    if (year.length === 4) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * Create empty result when scraping fails
 */
function createEmptyResult(boletin: string, sourceUrl: string): ScrapedData {
  return {
    boletin,
    stage: null,
    chamberCurrent: null,
    lastAction: null,
    lastActionDate: null,
    urgency: null,
    commission: null,
    sourceUrl,
  };
}

/**
 * Fetch multiple projects in parallel with rate limiting
 */
export async function fetchMultipleProjects(
  boletines: string[],
  delayMs = 500,
): Promise<Map<string, ScrapedData | Error>> {
  const results = new Map<string, ScrapedData | Error>();

  for (const boletin of boletines) {
    try {
      const data = await fetchProjectStatus(boletin);
      results.set(boletin, data);
    } catch (error) {
      results.set(boletin, error instanceof Error ? error : new Error(String(error)));
    }

    // Add delay between requests to be respectful to the API
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
