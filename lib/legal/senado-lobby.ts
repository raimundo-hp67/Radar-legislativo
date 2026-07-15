/**
 * Parser PURO del lobby del Senado (sin red ni base de datos).
 *
 * Fuente confirmada empíricamente (diagnóstico rounds 2-3, jul 2026):
 *   GET https://web-back.senado.cl/api/transparency/audiences?per_page=10&page=N
 *   → JSON { data: { audiencias: { current_page, last_page, total, data: [...] } } }
 *
 * Hallazgos importantes de esos diagnósticos:
 *  - La API IGNORA per_page y cualquier filtro de año/fecha/orden probado
 *    (year/ano/anno/fecha_desde/sort/order): siempre 10 por página.
 *  - El orden NO es estrictamente cronológico: hay fechas mezcladas dentro de
 *    cada página, por lo que el corte por antigüedad se decide en el servicio
 *    (senado-service) y aquí solo se filtra por ventana de meses.
 *  - Cada registro trae al destinatario (senador/a) en `user_data` y lo que
 *    representa el solicitante en `represented`; el NOMBRE del solicitante no
 *    viene en este endpoint. `user_data` incluye datos de contacto del
 *    parlamentario (email/RUT) que NO copiamos: solo nombre y apellido.
 */
import type { NewLobbyAudiencia } from '~/db/schema';

export const SENADO_AUDIENCIAS_URL = 'https://web-back.senado.cl/api/transparency/audiences';
export const SENADO_PAGINA_URL = 'https://www.senado.cl/transparencia/lobby/registros-de-audiencias';
export const SENADO_INSTITUCION = 'SENADO DE LA REPÚBLICA';

/** Registro crudo tal como lo entrega la API (solo los campos que usamos). */
export interface SenadoAudienciaRaw {
  id: number
  lugar?: string | null
  region?: string | null
  comuna?: string | null
  fecha?: string | null
  hora?: string | null
  duracion?: number | null
  tipo_reunion?: string | null
  reunion_o_audiencia?: string | null
  materia_tratada?: string | null
  boletin?: string | null
  observaciones?: string | null
  created_at?: string | null
  user_data?: {
    name?: string | null
    lastname?: string | null
  } | null
  represented?: unknown
}

export interface SenadoPage {
  records: SenadoAudienciaRaw[]
  currentPage: number
  lastPage: number
  total: number
}

/** Extrae registros y paginación del envelope { data: { audiencias: … } }. */
export function parseSenadoPage(json: unknown): SenadoPage | null {
  const aud = (json as { data?: { audiencias?: Record<string, unknown> } })?.data?.audiencias;
  if (!aud || typeof aud !== 'object') return null;
  const data = aud.data;
  if (!Array.isArray(data)) return null;
  return {
    records: data as SenadoAudienciaRaw[],
    currentPage: Number(aud.current_page) || 1,
    lastPage: Number(aud.last_page) || 1,
    total: Number(aud.total) || data.length,
  };
}

/** "2023-06-14T04:00:00.000000Z" → "2023-06-14" (null si no parsea). */
export function parseSenadoFecha(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Convierte un registro crudo de la API al shape de lobby_audiencias.
 * Devuelve null si el registro no tiene id (no podríamos deduplicarlo).
 */
export function toLobbyAudiencia(raw: SenadoAudienciaRaw): NewLobbyAudiencia | null {
  if (!raw || typeof raw.id !== 'number') return null;

  const nombre = clean(raw.user_data?.name);
  const apellido = clean(raw.user_data?.lastname);
  const sujetoPasivo = [nombre, apellido].filter(Boolean).join(' ') || null;

  const represented = Array.isArray(raw.represented)
    ? raw.represented.map((r) => clean(r)).filter((r): r is string => Boolean(r)).join(', ') || null
    : null;

  const lugar = [clean(raw.lugar), clean(raw.comuna)].filter(Boolean).join(', ') || null;

  const observacionesParts = [clean(raw.observaciones)];
  if (clean(raw.boletin)) observacionesParts.push(`Boletín: ${clean(raw.boletin)}`);
  const observaciones = observacionesParts.filter(Boolean).join(' · ') || null;

  const fecha = parseSenadoFecha(raw.fecha);
  const materia = clean(raw.materia_tratada);

  const searchText = [
    sujetoPasivo,
    SENADO_INSTITUCION,
    represented,
    materia,
    lugar,
    fecha,
  ].filter(Boolean).join(' ').toLowerCase();

  return {
    infolobbyId: `senado:${raw.id}`,
    fecha,
    lugar,
    forma: clean(raw.tipo_reunion),
    tipoAudiencia: clean(raw.reunion_o_audiencia) ?? 'Audiencia',
    sujetoPasivo,
    sujetoPasivoCargo: 'Senador/a',
    sujetoPasivoInstitucion: SENADO_INSTITUCION,
    // El endpoint no entrega el nombre del solicitante, solo a quién representa.
    sujetoActivo: null,
    sujetoActivoTipo: null,
    sujetoActivoOrganizacion: represented,
    materia,
    observaciones,
    searchText,
    sourceUrl: SENADO_PAGINA_URL,
  };
}

/** ¿La audiencia (por su fecha) cae dentro de los últimos `months` meses? */
export function isWithinMonths(fecha: string | null, months: number, now: Date = new Date()): boolean {
  if (!fecha) return false;
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - months);
  const parsed = new Date(`${fecha}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed >= cutoff;
}
