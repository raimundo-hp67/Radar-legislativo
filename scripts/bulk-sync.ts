/**
 * Carga masiva del cache de proyectos de ley desde el Senado (habilita el
 * buscador de la pestaña Investigación).
 *
 * ⏱️ Es LENTO por diseño (respeta la API pública): ~10-30 minutos para el
 * rango por defecto. Puedes interrumpirlo y retomarlo: es idempotente.
 *
 * Uso:
 *   bun run scripts/bulk-sync.ts                  # rango por defecto (17000-18500, ~2024-2026)
 *   bun run scripts/bulk-sync.ts 16000 17000      # rango de boletines a elección
 *   bun run scripts/bulk-sync.ts --if-empty       # no hace nada si el catálogo ya está cargado
 *                                                 # (lo usa el instalador para ser idempotente)
 */

import postgres from 'postgres';
import { isPooledConnectionString } from '../lib/db-utils';

const DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://postgres:postgres@localhost:5432/postgres';

// Con connection strings de pooler (Neon/Supabase en modo transacción) hay que
// desactivar prepared statements o postgres.js falla. La app hace lo mismo.
const sql = postgres(DATABASE_URL, { prepare: !isPooledConnectionString(DATABASE_URL) });

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
  autores: string[]
}

// Fetch a single project by boletin
async function fetchProject(boletin: string): Promise<SenadoProject | null> {
  try {
    const url = `https://tramitacion.senado.cl/wspublico/tramitacion.php?boletin=${boletin}`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/xml, text/xml, */*',
        'User-Agent': 'Mozilla/5.0 (compatible; RadarLegislativo/1.0)',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const xml = await response.text();

    if (xml.includes('No existe el n') || xml.includes('<proyectos></proyectos>')) {
      return null;
    }

    return parseProject(xml);
  } catch {
    return null;
  }
}

// Parse XML response
function parseProject(xml: string): SenadoProject | null {
  const projectMatch = xml.match(/<proyecto>[\s\S]*?<\/proyecto>/i);
  if (!projectMatch) return null;

  const projectXml = projectMatch[0];
  const boletin = extractValue(projectXml, 'boletin');
  if (!boletin) return null;

  // Get last tramite
  const tramites = projectXml.match(/<tramite>[\s\S]*?<\/tramite>/gi) || [];
  let ultimoTramite = null;
  let fechaUltimoTramite = null;
  if (tramites.length > 0) {
    const last = tramites[tramites.length - 1];
    ultimoTramite = extractValue(last, 'DESCRIPCIONTRAMITE');
    fechaUltimoTramite = extractValue(last, 'FECHA');
  }

  // Get autores
  const autores: string[] = [];
  const autorMatches = projectXml.matchAll(/<PARLAMENTARIO>([^<]+)<\/PARLAMENTARIO>/gi);
  for (const match of autorMatches) {
    if (match[1]) autores.push(cleanText(match[1]));
  }

  return {
    boletin,
    titulo: extractValue(projectXml, 'titulo') || '',
    fechaIngreso: formatDate(extractValue(projectXml, 'fecha_ingreso')),
    estado: cleanText(extractValue(projectXml, 'estado') || ''),
    etapa: extractValue(projectXml, 'etapa'),
    subetapa: extractValue(projectXml, 'subetapa'),
    camaraOrigen: extractValue(projectXml, 'camara_origen'),
    urgencia: extractValue(projectXml, 'urgencia_actual') || extractValue(projectXml, 'urgencia'),
    ultimoTramite,
    fechaUltimoTramite: formatDate(fechaUltimoTramite),
    autores,
  };
}

function extractValue(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i'));
  return match?.[1] ? cleanText(match[1]) : null;
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
  const match = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}

// Save project to database
async function saveProject(project: SenadoProject): Promise<'inserted' | 'updated' | 'error'> {
  const searchText = [
    project.titulo,
    project.boletin,
    project.estado,
    project.etapa,
    project.camaraOrigen,
    project.autores.join(' '),
  ].filter(Boolean).join(' ').toLowerCase();

  const sourceUrl = `https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=${project.boletin}`;

  try {
    // Check if exists
    const existing = await sql`
      SELECT id FROM project_cache WHERE boletin = ${project.boletin} LIMIT 1
    `;

    if (existing.length > 0) {
      await sql`
        UPDATE project_cache SET
          titulo = ${project.titulo},
          fecha_ingreso = ${project.fechaIngreso},
          estado = ${project.estado},
          etapa = ${project.etapa},
          subetapa = ${project.subetapa},
          camara_origen = ${project.camaraOrigen},
          urgencia = ${project.urgencia},
          ultimo_tramite = ${project.ultimoTramite},
          fecha_ultimo_tramite = ${project.fechaUltimoTramite},
          autores = ${project.autores.join(', ')},
          search_text = ${searchText},
          source_url = ${sourceUrl},
          is_active = true,
          last_synced_at = NOW(),
          updated_at = NOW()
        WHERE boletin = ${project.boletin}
      `;
      return 'updated';
    } else {
      await sql`
        INSERT INTO project_cache (
          boletin, titulo, fecha_ingreso, estado, etapa, subetapa,
          camara_origen, urgencia, ultimo_tramite, fecha_ultimo_tramite,
          autores, search_text, source_url, is_active
        ) VALUES (
          ${project.boletin}, ${project.titulo}, ${project.fechaIngreso},
          ${project.estado}, ${project.etapa}, ${project.subetapa},
          ${project.camaraOrigen}, ${project.urgencia}, ${project.ultimoTramite},
          ${project.fechaUltimoTramite}, ${project.autores.join(', ')},
          ${searchText}, ${sourceUrl}, true
        )
      `;
      return 'inserted';
    }
  } catch (error) {
    console.error(`Error saving ${project.boletin}:`, error);
    return 'error';
  }
}

// Main sync function
async function bulkSync(startBoletin: number, endBoletin: number) {
  console.log(`\n🚀 Starting bulk sync: boletins ${startBoletin} to ${endBoletin}\n`);

  let inserted = 0;
  let updated = 0;
  let notFound = 0;
  let errors = 0;

  const batchSize = 10; // Fetch 10 at a time

  for (let i = startBoletin; i <= endBoletin; i += batchSize) {
    const batch = Array.from({ length: Math.min(batchSize, endBoletin - i + 1) }, (_, j) => i + j);

    // Fetch batch in parallel
    const results = await Promise.all(batch.map((b) => fetchProject(String(b))));

    // Save results
    for (let j = 0; j < results.length; j++) {
      const project = results[j];
      const boletin = batch[j];

      if (project) {
        const result = await saveProject(project);
        if (result === 'inserted') {
          inserted++;
          console.log(`✅ [${boletin}] Inserted: ${project.titulo.substring(0, 60)}...`);
        } else if (result === 'updated') {
          updated++;
          console.log(`🔄 [${boletin}] Updated: ${project.titulo.substring(0, 60)}...`);
        } else {
          errors++;
        }
      } else {
        notFound++;
      }
    }

    // Progress
    const progress = Math.round(((i - startBoletin) / (endBoletin - startBoletin)) * 100);
    console.log(`\n📊 Progress: ${progress}% | Found: ${inserted + updated} | Not found: ${notFound}\n`);

    // Small delay to avoid overwhelming the API
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📋 SYNC COMPLETE');
  console.log('='.repeat(60));
  console.log(`✅ Inserted: ${inserted}`);
  console.log(`🔄 Updated: ${updated}`);
  console.log(`❌ Not found: ${notFound}`);
  console.log(`⚠️  Errors: ${errors}`);
  console.log('='.repeat(60) + '\n');

  // Get final count
  const [{ count }] = await sql`SELECT COUNT(*) as count FROM project_cache`;
  console.log(`📦 Total projects in cache: ${count}\n`);

  await sql.end();
}

// Rango por CLI o default 2024-2026 (aprox. boletines 17000-18500)
const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ifEmpty = flags.includes('--if-empty');

const start = Number(positional[0] ?? 17000);
const end = Number(positional[1] ?? 18500);

if (!Number.isInteger(start) || !Number.isInteger(end) || start >= end) {
  console.error('Uso: bun run scripts/bulk-sync.ts [inicio] [fin] [--if-empty]   (ej: 17000 18500)');
  process.exit(1);
}

// Con --if-empty, un catálogo ya poblado significa "nada que hacer": permite
// que el instalador lance este script en cada corrida sin recargar todo.
const ALREADY_LOADED_THRESHOLD = 500;

async function main() {
  if (ifEmpty) {
    const [{ count }] = await sql`SELECT COUNT(*) as count FROM project_cache`;
    if (Number(count) >= ALREADY_LOADED_THRESHOLD) {
      console.log(`✓ Catálogo ya cargado (${count} boletines) — nada que hacer.`);
      console.log('  (La app va agregando los boletines nuevos sola mientras corre.)');
      await sql.end();
      return;
    }
  }

  const estimatedMinutes = Math.max(1, Math.round(((end - start) / 10) * 0.5 / 60 * 3));
  console.log(`Rango de boletines: ${start}-${end} (~${end - start} boletines)`);
  console.log(`⏱️  Duración estimada: ~${estimatedMinutes} minutos. Puedes interrumpir con Ctrl+C y retomar después.\n`);

  await bulkSync(start, end);
}

main();
