/**
 * Official Ley de Lobby API client (leylobby.gob.cl/api/v1).
 *
 * This is the authoritative source for Law 20.730 lobby records. It is more
 * reliable than scraping the public InfoLobby/VirtuosoLobby feed, but requires:
 *   - LEYLOBBY_API_KEY      — issued by the platform, sent as the `Api-Key` header
 *   - LEYLOBBY_INSTITUCIONES — comma-separated institution codes to pull
 *
 * When either is missing this source is inert (`isLeyLobbyEnabled()` → false)
 * and callers fall back to InfoLobby. The response shape is mapped defensively
 * so markup/field changes degrade gracefully rather than throwing.
 */

import { db } from '~/db';
import { lobbyAudiencias } from '~/db/schema';
import type { NewLobbyAudiencia } from '~/db/schema';
import { env } from '~/config/env';

const LEYLOBBY_API_BASE = 'https://www.leylobby.gob.cl/api/v1';

export function isLeyLobbyEnabled(): boolean {
  return Boolean(env.LEYLOBBY_API_KEY && env.LEYLOBBY_INSTITUCIONES?.trim());
}

function institutionCodes(): string[] {
  return (env.LEYLOBBY_INSTITUCIONES ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
}

// Raw audiencia as returned by the official API (fields are best-effort optional).
interface LeyLobbyAudiencia {
  id?: string | number
  referencia?: string
  fecha_inicio?: string
  forma?: string
  lugar?: string
  nombres?: string
  apellidos?: string
  cargo?: string
  institucion?: string
  materias?: string | string[]
  asistentes?: Array<{ nombre?: string, trabaja_para?: string, representa_a?: string }>
  enlace?: string
}

interface LeyLobbyResponse {
  data?: LeyLobbyAudiencia[]
  links?: { next?: string | null }
}

function joinMaterias(materias: string | string[] | undefined): string | null {
  if (!materias) return null;
  if (Array.isArray(materias)) return materias.filter(Boolean).join('; ') || null;
  return materias || null;
}

function firstAsistente(a: LeyLobbyAudiencia): { sujeto: string | null, org: string | null } {
  const first = a.asistentes?.[0];
  if (!first) return { sujeto: null, org: null };
  return {
    sujeto: first.nombre || null,
    org: first.representa_a || first.trabaja_para || null,
  };
}

function toDbRow(a: LeyLobbyAudiencia, institucionCodigo: string, sourceUrl: string): NewLobbyAudiencia | null {
  const rawId = a.id ?? a.referencia;
  if (!rawId) return null;

  const sujetoPasivo = [a.nombres, a.apellidos].filter(Boolean).join(' ') || null;
  const institucion = a.institucion || institucionCodigo;
  const { sujeto, org } = firstAsistente(a);
  const materia = joinMaterias(a.materias);

  const searchText = [sujetoPasivo, a.cargo, institucion, materia, sujeto, org]
    .filter(Boolean)
    .join(' ')
    .toLowerCase() || null;

  return {
    // Prefix avoids id collisions with the numeric InfoLobby ids.
    infolobbyId: `LL-${rawId}`,
    fecha: a.fecha_inicio ? a.fecha_inicio.slice(0, 10) : null,
    lugar: a.lugar || null,
    forma: a.forma || null,
    tipoAudiencia: 'Audiencia',
    sujetoPasivo,
    sujetoPasivoCargo: a.cargo || null,
    sujetoPasivoInstitucion: institucion,
    sujetoActivo: sujeto,
    sujetoActivoTipo: null,
    sujetoActivoOrganizacion: org,
    materia,
    observaciones: null,
    searchText,
    sourceUrl,
    fetchedAt: new Date(),
  };
}

async function fetchInstitutionAudiencias(
  codigo: string,
  months: number,
  verbose: boolean,
): Promise<NewLobbyAudiencia[]> {
  const apiKey = env.LEYLOBBY_API_KEY as string;
  const rows: NewLobbyAudiencia[] = [];
  const now = new Date();

  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const anno = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');

    let url: string | null = `${LEYLOBBY_API_BASE}/instituciones/${codigo}/audiencias/${anno}/${mes}`;
    let guard = 0; // cap pagination to avoid runaway loops

    while (url && guard < 20) {
      guard++;
      try {
        const resp = await fetch(url, {
          headers: { 'Api-Key': apiKey, Accept: 'application/json' },
          signal: AbortSignal.timeout(15000),
        });
        if (!resp.ok) {
          if (verbose) console.warn(`[LeyLobby] ${codigo} ${anno}/${mes} → HTTP ${resp.status}`);
          break;
        }
        const body = await resp.json() as LeyLobbyResponse | LeyLobbyAudiencia[];
        const items = Array.isArray(body) ? body : (body.data ?? []);
        for (const item of items) {
          const row = toDbRow(item, codigo, url);
          if (row) rows.push(row);
        }
        url = Array.isArray(body) ? null : (body.links?.next ?? null);
      } catch (error) {
        if (verbose) console.warn(`[LeyLobby] fetch failed for ${codigo} ${anno}/${mes}:`, error instanceof Error ? error.message : error);
        break;
      }
    }
  }

  return rows;
}

export interface SyncLobbyResult {
  inserted: number
  skipped: number
  errors: number
}

/**
 * Sync audiencias from the official Ley de Lobby API for the configured
 * institutions over the last N months. Idempotent upserts (ON CONFLICT DO
 * NOTHING). Returns inserted/skipped/error counts.
 */
export async function syncLobbyFromLeyLobby(options: {
  months?: number
  verbose?: boolean
} = {}): Promise<SyncLobbyResult> {
  const { months = 6, verbose = false } = options;
  const result: SyncLobbyResult = { inserted: 0, skipped: 0, errors: 0 };

  const codes = institutionCodes();
  if (verbose) console.log(`[LeyLobby] Syncing ${codes.length} institution(s) over ${months} month(s)`);

  for (const codigo of codes) {
    const rows = await fetchInstitutionAudiencias(codigo, months, verbose);
    if (rows.length === 0) continue;

    try {
      const BATCH_SIZE = 100;
      for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
        const batch = rows.slice(offset, offset + BATCH_SIZE);
        const insertedRows = await db
          .insert(lobbyAudiencias)
          .values(batch)
          .onConflictDoNothing()
          .returning({ id: lobbyAudiencias.id });
        result.inserted += insertedRows.length;
        result.skipped += batch.length - insertedRows.length;
      }
    } catch (error) {
      console.error(`[LeyLobby] DB insert error for ${codigo}:`, error instanceof Error ? error.message : error);
      result.errors += rows.length;
    }
  }

  if (verbose) {
    console.log(`[LeyLobby] Sync complete — inserted: ${result.inserted}, skipped: ${result.skipped}, errors: ${result.errors}`);
  }

  return result;
}
