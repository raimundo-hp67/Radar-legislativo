/**
 * Service for syncing legislative projects from Senado to local cache.
 * Individual requests stay short and bounded to be polite with the public
 * Senado API; the full historical load lives in scripts/bulk-sync.ts.
 */

import { db } from '~/db';
import { projectCache } from '~/db/schema';
import { eq, sql } from 'drizzle-orm';
import { radarConfig } from '~/config/radar.config';

interface SenadoProjectXml {
  boletin: string
  titulo: string
  fechaIngreso: string | null
  estado: string | null
  etapa: string | null
  subetapa: string | null
  camaraOrigen: string | null
  urgencia: string | null
  ultimoTramite: string | null
  fechaUltimoTramite: string | null
  autores: string[]
}

// Seed boletins for the quick cache refresh — defined per-theme in
// config/radar.config.ts (kept short so a refresh takes seconds)
const SEED_BOLETINS = radarConfig.cacheSeedBoletines;

/**
 * Fetch a single project by boletin number (optimized timeout)
 */
async function fetchProjectByBoletin(boletin: string): Promise<SenadoProjectXml | null> {
  try {
    const boletinNum = boletin.split('-')[0];
    const url = `https://tramitacion.senado.cl/wspublico/tramitacion.php?boletin=${boletinNum}`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/xml, text/xml, */*',
        'User-Agent': 'Mozilla/5.0 (compatible; RadarLegislativo/1.0)',
      },
      signal: AbortSignal.timeout(3000), // 3 second timeout per request
    });

    if (response.ok) {
      const xml = await response.text();
      if (xml.includes('No existe el n') || xml.includes('<proyectos></proyectos>')) {
        return null;
      }
      const projects = parseProjectsFromXml(xml);
      return projects[0] || null;
    }
  } catch (error) {
    console.warn(`Fetch failed for boletin ${boletin}:`, error instanceof Error ? error.message : 'Unknown');
  }

  return null;
}

/**
 * Parse projects from Senado XML response
 */
function parseProjectsFromXml(xml: string): SenadoProjectXml[] {
  const projects: SenadoProjectXml[] = [];
  const projectMatches = xml.match(/<proyecto>[\s\S]*?<\/proyecto>/gi) || [];

  for (const projectXml of projectMatches) {
    const boletin = extractXmlValue(projectXml, 'boletin');
    if (!boletin) continue;

    // Extract last tramite info
    const tramiteMatches = projectXml.match(/<tramite>[\s\S]*?<\/tramite>/gi) || [];
    let ultimoTramite = null;
    let fechaUltimoTramite = null;

    if (tramiteMatches.length > 0) {
      const lastTramite = tramiteMatches[tramiteMatches.length - 1];
      ultimoTramite = extractXmlValue(lastTramite, 'DESCRIPCIONTRAMITE');
      fechaUltimoTramite = extractXmlValue(lastTramite, 'FECHA');
    }

    projects.push({
      boletin,
      titulo: extractXmlValue(projectXml, 'titulo') || '',
      fechaIngreso: formatDate(extractXmlValue(projectXml, 'fecha_ingreso')),
      estado: cleanText(extractXmlValue(projectXml, 'estado') || ''),
      etapa: extractXmlValue(projectXml, 'etapa'),
      subetapa: extractXmlValue(projectXml, 'subetapa'),
      camaraOrigen: extractXmlValue(projectXml, 'camara_origen'),
      urgencia: extractXmlValue(projectXml, 'urgencia_actual') || extractXmlValue(projectXml, 'urgencia'),
      ultimoTramite,
      fechaUltimoTramite: formatDate(fechaUltimoTramite),
      autores: extractAutores(projectXml),
    });
  }

  return projects;
}

/**
 * Extract autores from XML
 */
function extractAutores(xml: string): string[] {
  const autores: string[] = [];
  const pattern = /<PARLAMENTARIO>([^<]+)<\/PARLAMENTARIO>/gi;
  let match;
  while ((match = pattern.exec(xml)) !== null) {
    if (match[1]) {
      autores.push(cleanText(match[1]));
    }
  }
  return autores;
}

/**
 * Sync projects to database
 */
async function syncProjectsToCache(projects: SenadoProjectXml[]): Promise<{ inserted: number, updated: number, errors: string[] }> {
  let inserted = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const project of projects) {
    const searchText = [
      project.titulo,
      project.boletin,
      project.estado,
      project.etapa,
      project.camaraOrigen,
      project.autores.join(' '),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const sourceUrl = `https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=${project.boletin}`;

    try {
      const existing = await db
        .select({ id: projectCache.id })
        .from(projectCache)
        .where(eq(projectCache.boletin, project.boletin))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(projectCache)
          .set({
            titulo: project.titulo,
            fechaIngreso: project.fechaIngreso,
            estado: project.estado,
            etapa: project.etapa,
            subetapa: project.subetapa,
            camaraOrigen: project.camaraOrigen,
            urgencia: project.urgencia,
            ultimoTramite: project.ultimoTramite,
            fechaUltimoTramite: project.fechaUltimoTramite,
            autores: project.autores.join(', '),
            searchText,
            sourceUrl,
            isActive: true,
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(projectCache.boletin, project.boletin));
        updated++;
      } else {
        await db.insert(projectCache).values({
          boletin: project.boletin,
          titulo: project.titulo,
          fechaIngreso: project.fechaIngreso,
          estado: project.estado,
          etapa: project.etapa,
          subetapa: project.subetapa,
          camaraOrigen: project.camaraOrigen,
          urgencia: project.urgencia,
          ultimoTramite: project.ultimoTramite,
          fechaUltimoTramite: project.fechaUltimoTramite,
          autores: project.autores.join(', '),
          searchText,
          sourceUrl,
          isActive: true,
        });
        inserted++;
      }
    } catch (error) {
      const errMsg = `Failed to sync ${project.boletin}: ${error instanceof Error ? error.message : 'Unknown'}`;
      console.error(errMsg);
      errors.push(errMsg);
    }
  }

  return { inserted, updated, errors };
}

/**
 * Quick refresh of the seed boletins (fetches them all in parallel).
 * Use syncNewBoletines() to discover bills that entered after the last sync.
 */
export async function syncRecentProjects(): Promise<{
  total: number
  inserted: number
  updated: number
  errors: string[]
}> {
  console.log('Starting optimized sync...');
  const startTime = Date.now();

  // Fetch all boletins in parallel (max ~3s per request, all at once)
  const results = await Promise.allSettled(
    SEED_BOLETINS.map((b) => fetchProjectByBoletin(b)),
  );

  const projects: SenadoProjectXml[] = [];
  const fetchErrors: string[] = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      projects.push(result.value);
    } else if (result.status === 'rejected') {
      fetchErrors.push(`Boletin ${SEED_BOLETINS[index]}: ${result.reason}`);
    }
  });

  console.log(`Fetched ${projects.length}/${SEED_BOLETINS.length} projects in ${Date.now() - startTime}ms`);

  if (projects.length === 0) {
    return {
      total: 0,
      inserted: 0,
      updated: 0,
      errors: fetchErrors.length > 0 ? fetchErrors : ['No projects fetched from Senado API'],
    };
  }

  const { inserted, updated, errors: dbErrors } = await syncProjectsToCache(projects);
  const allErrors = [...fetchErrors, ...dbErrors];

  console.log(`Sync complete in ${Date.now() - startTime}ms: ${inserted} inserted, ${updated} updated`);

  return {
    total: projects.length,
    inserted,
    updated,
    errors: allErrors,
  };
}

/**
 * Discover bills that entered Congress AFTER the newest boletin already in
 * the cache. Boletin numbers are assigned sequentially, so probing forward
 * from the highest known number finds everything new without re-scanning
 * history. Stops after a run of consecutive misses (end of the sequence)
 * or after maxProbes attempts, whichever comes first.
 */
export async function syncNewBoletines(options: { maxProbes?: number } = {}): Promise<{
  total: number
  inserted: number
  updated: number
  errors: string[]
}> {
  const maxProbes = options.maxProbes ?? 150;
  const missLimit = 15;
  const batchSize = 5;

  const [row] = await db
    .select({
      maxBoletin: sql<number | null>`max((substring(${projectCache.boletin} from '^[0-9]+'))::int)`,
    })
    .from(projectCache);

  const start = row?.maxBoletin ? Number(row.maxBoletin) : null;
  if (!start) {
    return {
      total: 0,
      inserted: 0,
      updated: 0,
      errors: ['Catálogo vacío: corre `bun run scripts/bulk-sync.ts` para la carga inicial'],
    };
  }

  const found: SenadoProjectXml[] = [];
  let misses = 0;
  let probes = 0;
  let next = start + 1;

  while (probes < maxProbes && misses < missLimit) {
    const size = Math.min(batchSize, maxProbes - probes);
    const batch = Array.from({ length: size }, (_, i) => next + i);
    next += size;
    probes += size;

    const results = await Promise.allSettled(batch.map((b) => fetchProjectByBoletin(String(b))));
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        found.push(result.value);
        misses = 0;
      } else {
        misses += 1;
      }
    }

    // Small pause between batches to be polite with the public API
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  if (found.length === 0) {
    return { total: 0, inserted: 0, updated: 0, errors: [] };
  }

  const { inserted, updated, errors } = await syncProjectsToCache(found);
  return { total: found.length, inserted, updated, errors };
}

/**
 * Bulk sync by years (for manual/cron use)
 */
export async function syncProjectsByYears(startYear: number, endYear: number): Promise<{
  total: number
  inserted: number
  updated: number
  errors: string[]
}> {
  // Generate sample boletins for each year
  const boletins: string[] = [];
  for (let year = startYear; year <= endYear; year++) {
    const baseNum = 13000 + (year - 2020) * 1000;
    for (let i = 0; i < 50; i += 10) {
      boletins.push(String(baseNum + i));
    }
  }

  // Fetch in smaller batches to avoid overwhelming the API
  const batchSize = 5;
  const allProjects: SenadoProjectXml[] = [];
  const errors: string[] = [];

  for (let i = 0; i < boletins.length; i += batchSize) {
    const batch = boletins.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((b) => fetchProjectByBoletin(b)),
    );

    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        allProjects.push(result.value);
      }
    });
  }

  // Deduplicate
  const uniqueProjects = new Map<string, SenadoProjectXml>();
  for (const p of allProjects) {
    uniqueProjects.set(p.boletin, p);
  }

  const dedupedProjects = Array.from(uniqueProjects.values());
  const { inserted, updated, errors: dbErrors } = await syncProjectsToCache(dedupedProjects);

  return {
    total: dedupedProjects.length,
    inserted,
    updated,
    errors: [...errors, ...dbErrors],
  };
}

/**
 * Get cache stats
 */
export async function getCacheStats(): Promise<{
  total: number
  active: number
  lastSync: Date | null
  error?: string
}> {
  try {
    const [stats] = await db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where ${projectCache.isActive} = true)`,
        lastSync: sql<Date>`max(${projectCache.lastSyncedAt})`,
      })
      .from(projectCache);

    return {
      total: Number(stats.total) || 0,
      active: Number(stats.active) || 0,
      lastSync: stats.lastSync,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown database error';
    console.error('getCacheStats error:', errMsg);
    return {
      total: 0,
      active: 0,
      lastSync: null,
      error: errMsg,
    };
  }
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
