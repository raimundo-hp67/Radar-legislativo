import type { ScrapedData } from './types';

/**
 * Parse XML response from the Senado API
 * The Senado provides XML data at:
 * - Single project: /wspublico/tramitacion.php?boletin={numero}
 * - Recent changes: /wspublico/tramitacion.php?fecha={DD/MM/YYYY}
 */

interface SenadoProject {
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
  iniciativa: string | null
  autores: string[]
}

/**
 * Extract text content from an XML element by tag name
 */
function extractXmlValue(xml: string, tagName: string): string | null {
  // Try multiple patterns for XML elements
  const patterns = [
    new RegExp(`<${tagName}><!\\[CDATA\\[([^\\]]*?)\\]\\]></${tagName}>`, 'i'),
    new RegExp(`<${tagName}>([^<]*?)</${tagName}>`, 'i'),
    new RegExp(`<${tagName}\\s*/>`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match && match[1] !== undefined) {
      return cleanXmlText(match[1]);
    }
  }
  return null;
}

/**
 * Extract all values from repeating XML elements
 */
function extractXmlValues(xml: string, tagName: string): string[] {
  const results: string[] = [];
  const pattern = new RegExp(`<${tagName}>([^<]*?)</${tagName}>`, 'gi');
  let match;
  while ((match = pattern.exec(xml)) !== null) {
    if (match[1]) {
      const cleaned = cleanXmlText(match[1]);
      if (cleaned) {
        results.push(cleaned);
      }
    }
  }
  return results;
}

/**
 * Clean XML text content
 */
function cleanXmlText(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, '\'')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Format date from DD/MM/YYYY or YYYY-MM-DD to YYYY-MM-DD
 */
function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Convert from DD/MM/YYYY
  const match = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return null;
}

/**
 * Parse a single project from Senado XML response
 */
export function parseSenadoProjectXml(xml: string): SenadoProject | null {
  // Check if the response contains a project
  if (!xml.includes('<proyecto>') && !xml.includes('<boletin>')) {
    return null;
  }

  const boletin = extractXmlValue(xml, 'boletin') || extractXmlValue(xml, 'numero');
  if (!boletin) {
    return null;
  }

  return {
    boletin,
    titulo: extractXmlValue(xml, 'titulo') || extractXmlValue(xml, 'nombre') || '',
    fechaIngreso: formatDate(extractXmlValue(xml, 'fecha_ingreso') || extractXmlValue(xml, 'fechaIngreso')),
    estado: extractXmlValue(xml, 'estado'),
    etapa: extractXmlValue(xml, 'etapa') || extractXmlValue(xml, 'tramite'),
    subetapa: extractXmlValue(xml, 'subetapa') || extractXmlValue(xml, 'sub_etapa'),
    camaraOrigen: extractXmlValue(xml, 'camara_origen') || extractXmlValue(xml, 'camaraOrigen'),
    urgencia: extractXmlValue(xml, 'urgencia') || extractXmlValue(xml, 'urgencia_actual'),
    ultimoTramite: extractXmlValue(xml, 'descripcion_tramite') || extractXmlValue(xml, 'ultimo_tramite'),
    fechaUltimoTramite: formatDate(
      extractXmlValue(xml, 'fecha_tramite') || extractXmlValue(xml, 'fecha_ultimo_tramite'),
    ),
    iniciativa: extractXmlValue(xml, 'iniciativa') || extractXmlValue(xml, 'tipo_iniciativa'),
    autores: extractXmlValues(xml, 'autor').concat(extractXmlValues(xml, 'parlamentario')),
  };
}

/**
 * Parse multiple projects from Senado XML response (for fecha query)
 */
export function parseSenadoProjectListXml(xml: string): SenadoProject[] {
  const projects: SenadoProject[] = [];

  // Split by project tags
  const projectMatches = xml.match(/<proyecto>[\s\S]*?<\/proyecto>/gi);
  if (projectMatches) {
    for (const projectXml of projectMatches) {
      const project = parseSenadoProjectXml(projectXml);
      if (project) {
        projects.push(project);
      }
    }
  }

  return projects;
}

/**
 * Convert SenadoProject to ScrapedData format
 */
export function senadoProjectToScrapedData(project: SenadoProject, sourceUrl: string): ScrapedData {
  // Determine current chamber from stage or origin
  let chamberCurrent = project.camaraOrigen;
  if (project.etapa) {
    const lowerEtapa = project.etapa.toLowerCase();
    if (lowerEtapa.includes('segundo') || lowerEtapa.includes('2do') || lowerEtapa.includes('2°')) {
      // If in second tramite, chamber is the opposite of origin
      if (project.camaraOrigen?.toLowerCase().includes('diputado')) {
        chamberCurrent = 'Senado';
      } else if (project.camaraOrigen?.toLowerCase().includes('senado')) {
        chamberCurrent = 'Cámara de Diputados';
      }
    }
  }

  // Format stage/etapa with capitalized first letter
  let stage = project.etapa || project.estado;
  if (stage) {
    stage = stage.charAt(0).toUpperCase() + stage.slice(1).toLowerCase();
  }

  // Format urgency
  let urgency = project.urgencia;
  if (!urgency || urgency.toLowerCase() === 'sin' || urgency.toLowerCase() === 'no tiene') {
    urgency = 'Sin urgencia';
  }

  return {
    boletin: project.boletin,
    stage,
    chamberCurrent,
    lastAction: project.ultimoTramite,
    lastActionDate: project.fechaUltimoTramite,
    urgency,
    commission: null, // Senado XML doesn't provide commission info directly
    sourceUrl,
  };
}

/**
 * Fetch project data from Senado XML API
 */
export async function fetchFromSenadoXmlApi(boletin: string): Promise<ScrapedData | null> {
  // Extract only the numeric part of boletin (without the -XX suffix for materia)
  const boletinNumber = boletin.split('-')[0];
  const senadoApiUrl = `https://tramitacion.senado.cl/wspublico/tramitacion.php?boletin=${boletinNumber}`;
  const sourceUrl = `https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=${boletin}`;

  try {
    const response = await fetch(senadoApiUrl, {
      headers: {
        Accept: 'application/xml, text/xml, */*',
        'User-Agent': 'Mozilla/5.0 (compatible; RadarLegislativo/1.0)',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      console.warn(`Senado XML API returned ${response.status} for ${boletin}`);
      return null;
    }

    const xml = await response.text();

    // Check for error responses
    if (xml.includes('<error>') || xml.includes('no encontrado')) {
      console.warn(`Senado XML API: Project ${boletin} not found`);
      return null;
    }

    const project = parseSenadoProjectXml(xml);
    if (!project) {
      console.warn(`Senado XML API: Could not parse response for ${boletin}`);
      return null;
    }

    return senadoProjectToScrapedData(project, sourceUrl);
  } catch (error) {
    console.warn(`Senado XML API failed for ${boletin}:`, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Fetch projects with recent changes from Senado XML API
 * @param sinceDate Date in format DD/MM/YYYY (max 1 month ago)
 */
export async function fetchRecentChangesFromSenado(sinceDate: string): Promise<SenadoProject[]> {
  const senadoApiUrl = `https://tramitacion.senado.cl/wspublico/tramitacion.php?fecha=${sinceDate}`;

  try {
    const response = await fetch(senadoApiUrl, {
      headers: {
        Accept: 'application/xml, text/xml, */*',
        'User-Agent': 'Mozilla/5.0 (compatible; RadarLegislativo/1.0)',
      },
      signal: AbortSignal.timeout(60000), // Longer timeout for list queries
    });

    if (!response.ok) {
      console.warn(`Senado XML API returned ${response.status} for fecha=${sinceDate}`);
      return [];
    }

    const xml = await response.text();
    return parseSenadoProjectListXml(xml);
  } catch (error) {
    console.warn(`Senado XML API failed for fecha=${sinceDate}:`, error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}

/**
 * Get autores string from SenadoProject
 */
export function getAutoresString(project: SenadoProject): string {
  return project.autores.filter(Boolean).join(', ');
}
