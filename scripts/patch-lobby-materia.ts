/**
 * Batch-adds materia/observaciones from datosAudiencia_utf8.csv.
 * Uses unnest() for efficient batch updates.
 *
 * Usage: DATABASE_URL="..." bun run scripts/patch-lobby-materia.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || '';
if (!DATABASE_URL) {
  console.error('DATABASE_URL required');
  process.exit(1);
}

const sql = postgres(DATABASE_URL);
const TMP = join(process.cwd(), 'tmp');

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

async function main() {
  console.log('Batch patch: materia from datosAudiencia_utf8.csv\n');

  const existing = await sql`SELECT infolobby_id FROM lobby_audiencias`;
  const dbIds = new Set(existing.map((r) => r.infolobby_id as string));
  console.log(`  ${dbIds.size} audiencias in DB\n`);

  console.log('  Parsing datosAudiencia_utf8.csv...');
  const content = readFileSync(join(TMP, 'datosAudiencia_utf8.csv'), 'utf-8');
  const lines = content.split('\n');
  const rawHeaders = parseCSVLine(lines[0]);
  const headers = rawHeaders.map((h) =>
    h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
  );

  const codes: string[] = [];
  const materias: string[] = [];
  const observations: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = parseCSVLine(line);
    const obj: Record<string, string> = {};
    for (let j = 0; j < headers.length && j < vals.length; j++) {
      obj[headers[j]] = vals[j] || '';
    }
    const code = obj.codigouri || '';
    if (code && dbIds.has(code) && obj.materia) {
      codes.push(code);
      materias.push(obj.materia.slice(0, 500));
      observations.push((obj.observaciones || '').slice(0, 1000));
    }
    if (i % 200_000 === 0) console.log(`  Scanned ${i}/${lines.length}...`);
  }
  console.log(`  Found ${codes.length} updates\n`);

  // Batch update using unnest
  const BATCH = 500;
  let done = 0;
  for (let i = 0; i < codes.length; i += BATCH) {
    const batchCodes = codes.slice(i, i + BATCH);
    const batchMaterias = materias.slice(i, i + BATCH);
    const batchObs = observations.slice(i, i + BATCH);

    await sql`
      UPDATE lobby_audiencias la SET
        materia = v.materia,
        observaciones = v.obs,
        search_text = LEFT(COALESCE(la.search_text, '') || ' ' || LOWER(v.materia || ' ' || v.obs), 2000)
      FROM (
        SELECT unnest(${batchCodes}::text[]) as code,
               unnest(${batchMaterias}::text[]) as materia,
               unnest(${batchObs}::text[]) as obs
      ) v
      WHERE la.infolobby_id = v.code
    `;
    done += batchCodes.length;
    if (done % 5000 === 0 || done === codes.length) {
      console.log(`  Updated ${done}/${codes.length}`);
    }
  }

  const [count] = await sql`SELECT COUNT(*) FILTER (WHERE materia IS NOT NULL) as cnt FROM lobby_audiencias`;
  console.log(`\n  Rows with materia: ${count.cnt}`);

  const [sample] = await sql`SELECT sujeto_pasivo, materia FROM lobby_audiencias WHERE materia IS NOT NULL AND sujeto_pasivo ILIKE '%schalper%' LIMIT 1`;
  if (sample) console.log(`  Schalper materia: ${(sample.materia as string)?.slice(0, 100)}`);

  await sql.end();
  console.log('\nDone!');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
