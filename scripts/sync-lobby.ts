/**
 * Sync lobby audiencias from InfoLobby CSV files into PostgreSQL.
 *
 * Reads pre-downloaded and converted CSV files from tmp/:
 *   - audiencias_2024.csv       (audiencia records, 2024+)
 *   - datosAudiencia_2024.csv   (materia, observaciones per audiencia)
 *   - asistenciasPasivos_utf8.csv (government officials linked to audiencias)
 *   - activos_utf8.csv          (lobbyists linked to audiencias)
 *
 * Usage: DATABASE_URL="..." bun run scripts/sync-lobby.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || '';
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sql = postgres(DATABASE_URL);
const TMP = join(process.cwd(), 'tmp');

// ── CSV parser that handles quoted fields with embedded commas ──────────

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
      } else {
        inQuotes = !inQuotes;
      }
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

interface Row {
  [key: string]: string
}

function parseCSV(filePath: string): { headers: string[], rows: Row[] } {
  console.log(`  Reading ${filePath}...`);
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const rawHeaders = parseCSVLine(lines[0]);
  const headers = rawHeaders.map((h) =>
    h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
  );
  console.log(`  Headers: ${headers.join(', ')}`);

  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = parseCSVLine(line);
    const obj: Row = {};
    for (let j = 0; j < headers.length && j < vals.length; j++) {
      obj[headers[j]] = vals[j] || '';
    }
    rows.push(obj);
    if (rows.length % 100_000 === 0) console.log(`    ${rows.length} rows…`);
  }
  console.log(`  Total: ${rows.length} rows\n`);
  return { headers, rows };
}

// ── Streaming parser for large files ────────────────────────────────────

function streamCSV(
  filePath: string,
  matchIds: Set<string>,
  idExtractor: (row: Row) => string,
  onMatch: (audienciaId: string, row: Row) => void,
) {
  console.log(`  Streaming ${filePath}...`);
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const rawHeaders = parseCSVLine(lines[0]);
  const headers = rawHeaders.map((h) =>
    h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
  );
  console.log(`  Headers: ${headers.join(', ')}`);

  let matched = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = parseCSVLine(line);
    const obj: Row = {};
    for (let j = 0; j < headers.length && j < vals.length; j++) {
      obj[headers[j]] = vals[j] || '';
    }
    const audId = idExtractor(obj);
    if (audId && matchIds.has(audId)) {
      onMatch(audId, obj);
      matched++;
    }
    if ((i % 200_000) === 0) console.log(`    Scanned ${i} lines, ${matched} matched…`);
  }
  console.log(`  Matched: ${matched} rows\n`);
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60));
  console.log('  INFOLOBBY SYNC - Full 2024+ Audiencias');
  console.log('='.repeat(60) + '\n');

  // Step 1: Parse audiencias
  console.log('Step 1/5: Parse audiencias_2024.csv');
  const { rows: audiencias } = parseCSV(join(TMP, 'audiencias_2024.csv'));

  const audMap = new Map<string, {
    id: string
    fecha: string
    organismo: string
  }>();

  for (const r of audiencias) {
    const id = r.codigouri || '';
    if (id) {
      audMap.set(id, {
        id,
        fecha: r.fechaevento || '',
        organismo: r.organismo || '',
      });
    }
  }
  console.log(`  Indexed ${audMap.size} audiencias\n`);
  const audIds = new Set(audMap.keys());

  // Step 2: Parse datosAudiencia for materia/observaciones
  console.log('Step 2/5: Parse datosAudiencia_2024.csv');
  const datosMap = new Map<string, { materia: string, observaciones: string, descripcion: string }>();
  const { rows: datos } = parseCSV(join(TMP, 'datosAudiencia_2024.csv'));
  for (const r of datos) {
    const id = r.codigouri || '';
    if (id && audIds.has(id)) {
      datosMap.set(id, {
        materia: r.materia || '',
        observaciones: r.observaciones || '',
        descripcion: r.descripcion || '',
      });
    }
  }
  console.log(`  Matched datos for ${datosMap.size} audiencias\n`);

  // Step 3: Stream asistenciasPasivos for government official names
  console.log('Step 3/5: Stream asistenciasPasivos_utf8.csv');
  const pasivosMap = new Map<string, Array<{ nombre: string, cargo: string, organismo: string }>>();

  streamCSV(
    join(TMP, 'asistenciasPasivos_utf8.csv'),
    audIds,
    (row) => row.codigoaudiencia || '',
    (audId, row) => {
      if (!pasivosMap.has(audId)) pasivosMap.set(audId, []);
      pasivosMap.get(audId)!.push({
        nombre: row.pasivo || '',
        cargo: row.cargo || '',
        organismo: row.organismo || '',
      });
    },
  );
  console.log(`  Pasivos linked to ${pasivosMap.size} audiencias\n`);

  // Step 4: Stream activos for lobbyist names
  console.log('Step 4/5: Stream activos_utf8.csv');
  const activosMap = new Map<string, Array<{ nombre: string, tipo: string, organizacion: string }>>();

  streamCSV(
    join(TMP, 'activos_utf8.csv'),
    audIds,
    (row) => {
      const uri = row.uriaudiencia || '';
      const parts = uri.split('/');
      return parts[parts.length - 1] || '';
    },
    (audId, row) => {
      if (!activosMap.has(audId)) activosMap.set(audId, []);
      activosMap.get(audId)!.push({
        nombre: row.nombreactivo || row.nombre || '',
        tipo: row.tipoactivo || '',
        organizacion: row.organismo || '',
      });
    },
  );
  console.log(`  Activos linked to ${activosMap.size} audiencias\n`);

  // Step 5: Rebuild table and insert
  console.log('Step 5/5: Save to database\n');

  await sql`DROP TABLE IF EXISTS lobby_audiencias CASCADE`;
  await sql`
    CREATE TABLE lobby_audiencias (
      id SERIAL PRIMARY KEY,
      infolobby_id VARCHAR(100) NOT NULL UNIQUE,
      fecha VARCHAR(20),
      lugar TEXT,
      forma VARCHAR(50),
      tipo_audiencia VARCHAR(100),
      sujeto_pasivo TEXT,
      sujeto_pasivo_cargo TEXT,
      sujeto_pasivo_institucion TEXT,
      sujeto_activo TEXT,
      sujeto_activo_tipo VARCHAR(50),
      sujeto_activo_organizacion TEXT,
      materia TEXT,
      observaciones TEXT,
      search_text TEXT,
      source_url TEXT,
      fetched_at TIMESTAMP DEFAULT NOW() NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX idx_lobby_infolobby_id ON lobby_audiencias(infolobby_id)`;
  await sql`CREATE INDEX idx_lobby_fecha ON lobby_audiencias(fecha)`;
  await sql`CREATE INDEX idx_lobby_sujeto_pasivo ON lobby_audiencias(sujeto_pasivo)`;
  await sql`CREATE INDEX idx_lobby_sujeto_activo ON lobby_audiencias(sujeto_activo)`;
  await sql`CREATE INDEX idx_lobby_institucion ON lobby_audiencias(sujeto_pasivo_institucion)`;
  await sql`CREATE INDEX idx_lobby_search_text ON lobby_audiencias(search_text)`;
  console.log('  Table recreated\n');

  let saved = 0;
  let errors = 0;
  const total = audMap.size;

  const entries = Array.from(audMap.entries());

  for (let i = 0; i < entries.length; i += 100) {
    const batch = entries.slice(i, i + 100);
    const values = batch.map(([audId, aud]) => {
      const d = datosMap.get(audId);
      const pasivos = pasivosMap.get(audId) || [];
      const activos = activosMap.get(audId) || [];

      const sujetoPasivo = pasivos.map((p) => p.nombre).filter(Boolean).join(' | ') || null;
      const sujetoPasivoCargo = pasivos.map((p) => p.cargo).filter(Boolean).join(' | ') || null;
      const institution = aud.organismo || pasivos[0]?.organismo || null;
      const sujetoActivo = activos.map((a) => a.nombre).filter(Boolean).join(' | ') || null;
      const sujetoActivoTipo = activos[0]?.tipo || null;
      const sujetoActivoOrg = activos.map((a) => a.organizacion).filter(Boolean).join(' | ') || null;
      const materia = d?.materia || null;
      const observaciones = d?.observaciones || null;
      const fechaShort = aud.fecha ? aud.fecha.split(' ')[0] : null;

      const searchParts = [
        sujetoPasivo, sujetoPasivoCargo, institution,
        sujetoActivo, sujetoActivoOrg,
        materia, observaciones, d?.descripcion,
      ].filter(Boolean);
      const searchText = searchParts.join(' ').toLowerCase();

      return {
        infolobby_id: audId,
        fecha: fechaShort,
        sujeto_pasivo: sujetoPasivo,
        sujeto_pasivo_cargo: sujetoPasivoCargo,
        sujeto_pasivo_institucion: institution,
        sujeto_activo: sujetoActivo,
        sujeto_activo_tipo: sujetoActivoTipo,
        sujeto_activo_organizacion: sujetoActivoOrg,
        materia,
        observaciones,
        search_text: searchText || null,
        source_url: `https://www.infolobby.cl/Ficha/Audiencia/${audId}`,
      };
    });

    try {
      await sql`INSERT INTO lobby_audiencias ${sql(values)}`;
      saved += batch.length;
    } catch {
      for (const v of values) {
        try {
          await sql`INSERT INTO lobby_audiencias ${sql(v)}`;
          saved++;
        } catch (e) {
          errors++;
          if (errors <= 5) console.error(`  Error: ${(e as Error).message.slice(0, 100)}`);
        }
      }
    }

    if ((i + 100) % 5000 === 0 || i + 100 >= total) {
      const pct = Math.min(100, Math.round(((i + 100) / total) * 100));
      console.log(`  Progress: ${Math.min(i + 100, total)}/${total} (${pct}%) — ${saved} saved, ${errors} errors`);
    }
  }

  const [{ count }] = await sql`SELECT COUNT(*) as count FROM lobby_audiencias`;
  const [sample] = await sql`SELECT sujeto_pasivo, sujeto_activo, materia FROM lobby_audiencias WHERE sujeto_pasivo IS NOT NULL LIMIT 1`;

  console.log('\n' + '='.repeat(60));
  console.log('  SYNC COMPLETE');
  console.log('='.repeat(60));
  console.log(`  Saved: ${saved}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Total in DB: ${count}`);
  if (sample) {
    console.log(`  Sample pasivo: ${(sample.sujeto_pasivo as string)?.slice(0, 80)}`);
    console.log(`  Sample activo: ${(sample.sujeto_activo as string)?.slice(0, 80)}`);
    console.log(`  Sample materia: ${(sample.materia as string)?.slice(0, 80)}`);
  }

  await sql.end();
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
