/**
 * Service for searching legislative projects from local cache
 * Uses the project_cache table populated by sync service
 */

import { db } from '~/db';
import { projectCache } from '~/db/schema';
import { eq, ilike, or, desc, sql, and } from 'drizzle-orm';
import { radarConfig } from '~/config/radar.config';

export interface SearchResult {
  boletin: string
  titulo: string
  fechaIngreso: string | null
  estado: string | null
  camara: string | null
  autores: string | null
  materia: string | null
  resumen: string | null
  source: 'cache' | 'bcn' | 'senado'
  url: string
}

export interface SearchOptions {
  keywords: string[]
  limit?: number
  activeOnly?: boolean
}

// Default search keywords come from the theme config (config/radar.config.ts)
export const DEFAULT_SEARCH_KEYWORDS = radarConfig.searchKeywords;

/**
 * Search projects in local cache by keywords
 */
export async function searchProjectsInCache(
  keywords: string[],
  limit = 30,
  activeOnly = true,
): Promise<SearchResult[]> {
  if (keywords.length === 0) {
    return [];
  }

  // Build search conditions for each keyword
  const searchConditions = keywords.map((keyword) => {
    const searchPattern = `%${keyword.toLowerCase()}%`;
    return or(
      ilike(projectCache.searchText, searchPattern),
      ilike(projectCache.titulo, searchPattern),
      ilike(projectCache.autores, searchPattern),
      ilike(projectCache.materias, searchPattern),
    );
  });

  // Query the cache
  const results = await db
    .select({
      boletin: projectCache.boletin,
      titulo: projectCache.titulo,
      fechaIngreso: projectCache.fechaIngreso,
      estado: projectCache.estado,
      etapa: projectCache.etapa,
      camaraOrigen: projectCache.camaraOrigen,
      autores: projectCache.autores,
      materias: projectCache.materias,
      resumen: projectCache.resumen,
      sourceUrl: projectCache.sourceUrl,
    })
    .from(projectCache)
    .where(
      and(
        or(...searchConditions),
        activeOnly ? eq(projectCache.isActive, true) : undefined,
      ),
    )
    .orderBy(desc(projectCache.fechaIngreso))
    .limit(limit);

  return results.map((r) => ({
    boletin: r.boletin,
    titulo: r.titulo,
    fechaIngreso: r.fechaIngreso,
    estado: r.etapa || r.estado,
    camara: r.camaraOrigen,
    autores: r.autores,
    materia: r.materias,
    resumen: r.resumen,
    source: 'cache' as const,
    url: r.sourceUrl || `https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=${r.boletin}`,
  }));
}

/**
 * Search by specific boletin number in cache
 */
export async function searchByBoletinInCache(boletin: string): Promise<SearchResult | null> {
  const cleanBoletin = boletin.trim().replace(/\s/g, '');

  const [result] = await db
    .select({
      boletin: projectCache.boletin,
      titulo: projectCache.titulo,
      fechaIngreso: projectCache.fechaIngreso,
      estado: projectCache.estado,
      etapa: projectCache.etapa,
      camaraOrigen: projectCache.camaraOrigen,
      autores: projectCache.autores,
      materias: projectCache.materias,
      resumen: projectCache.resumen,
      sourceUrl: projectCache.sourceUrl,
    })
    .from(projectCache)
    .where(ilike(projectCache.boletin, `%${cleanBoletin}%`))
    .limit(1);

  if (!result) {
    return null;
  }

  return {
    boletin: result.boletin,
    titulo: result.titulo,
    fechaIngreso: result.fechaIngreso,
    estado: result.etapa || result.estado,
    camara: result.camaraOrigen,
    autores: result.autores,
    materia: result.materias,
    resumen: result.resumen,
    source: 'cache',
    url: result.sourceUrl || `https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=${result.boletin}`,
  };
}

/**
 * Fallback: Search by boletin directly from Senado API
 */
export async function searchByBoletinFromSenado(boletin: string): Promise<SearchResult | null> {
  const cleanBoletin = boletin.trim().replace(/\s/g, '');
  const boletinNumber = cleanBoletin.split('-')[0];

  try {
    const senadoUrl = `https://tramitacion.senado.cl/wspublico/tramitacion.php?boletin=${boletinNumber}`;

    const response = await fetch(senadoUrl, {
      headers: {
        Accept: 'application/xml, text/xml, */*',
        'User-Agent': 'Mozilla/5.0 (compatible; RadarLegislativo/1.0)',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      const xml = await response.text();
      const titulo = extractXmlValue(xml, 'titulo');

      if (titulo) {
        return {
          boletin: cleanBoletin,
          titulo,
          fechaIngreso: formatDate(extractXmlValue(xml, 'fecha_ingreso')),
          estado: extractXmlValue(xml, 'etapa') || extractXmlValue(xml, 'estado'),
          camara: extractXmlValue(xml, 'camara_origen'),
          autores: extractXmlValues(xml, 'autor').join(', ') || null,
          materia: null,
          resumen: null,
          source: 'senado',
          url: `https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=${cleanBoletin}`,
        };
      }
    }
  } catch (error) {
    console.warn('Senado API search failed:', error instanceof Error ? error.message : 'Unknown');
  }

  return null;
}

/**
 * Combined search: cache first, then fallback to API for boletin search
 */
export async function searchProjects(options: SearchOptions): Promise<SearchResult[]> {
  const { keywords, limit = 30 } = options;

  if (keywords.length === 0) {
    return [];
  }

  // Search in local cache
  const results = await searchProjectsInCache(keywords, limit);

  return results;
}

/**
 * Search by boletin: cache first, then API fallback
 */
export async function searchByBoletin(boletin: string): Promise<SearchResult | null> {
  // Try cache first
  const cacheResult = await searchByBoletinInCache(boletin);
  if (cacheResult) {
    return cacheResult;
  }

  // Fallback to direct API call
  return searchByBoletinFromSenado(boletin);
}

/**
 * Get cache statistics
 */
export async function getSearchCacheStats(): Promise<{
  totalProjects: number
  lastSync: Date | null
}> {
  const [stats] = await db
    .select({
      total: sql<number>`count(*)`,
      lastSync: sql<Date>`max(${projectCache.lastSyncedAt})`,
    })
    .from(projectCache);

  return {
    totalProjects: Number(stats.total) || 0,
    lastSync: stats.lastSync,
  };
}

// Helper functions
function extractXmlValue(xml: string, tagName: string): string | null {
  const patterns = [
    new RegExp(`<${tagName}><!\\[CDATA\\[([^\\]]*?)\\]\\]></${tagName}>`, 'i'),
    new RegExp(`<${tagName}>([^<]*?)</${tagName}>`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match?.[1]) {
      return cleanText(match[1]);
    }
  }
  return null;
}

function extractXmlValues(xml: string, tagName: string): string[] {
  const results: string[] = [];
  const pattern = new RegExp(`<${tagName}>([^<]*?)</${tagName}>`, 'gi');
  let match;
  while ((match = pattern.exec(xml)) !== null) {
    if (match[1]) {
      const cleaned = cleanText(match[1]);
      if (cleaned) results.push(cleaned);
    }
  }
  return results;
}

function cleanText(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  const match = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}
