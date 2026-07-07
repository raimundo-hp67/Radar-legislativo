/**
 * Parser del CSV de datos abiertos de InfoLobby (audiencias).
 *
 * El endpoint JSON antiguo (/VirtuosoLobby/Listado/Audiencia/…) quedó
 * obsoleto: responde HTTP 200 con `[]`. InfoLobby publica los datos vigentes
 * como un CSV acumulativo en:
 *   /VirtuosoLobby/Visualizacion/{año}/{mes}/dataset-audiencias.csv
 * con estas columnas (confirmadas contra la fuente real):
 *   nombreActivo, representado, personalidad, tipo, EmpresaLobby, Pasivo,
 *   organismo, cargo, anio, mes, dia, cantidadAudiencias
 *
 * Este módulo es PURO (sin red ni base de datos) para poder testearlo.
 */
import { createHash } from 'node:crypto';
import type { NewLobbyAudiencia } from '~/db/schema';

export const INFOLOBBY_BASE = 'https://www.infolobby.cl';

/** Parsea una línea CSV respetando comillas dobles y comas embebidas. */
export function parseCsvLine(line: string): string[] {
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
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function clean(value: string): string {
  return value.replace(/^"|"$/g, '').trim();
}

// El CSV de datos abiertos no trae el ID ni el código de institución de cada
// audiencia, así que no se puede armar el enlace directo al registro puntual.
// Apuntamos al directorio oficial de instituciones de leylobby.gob.cl para que
// el usuario navegue desde ahí. (Ojo: la UI construye este mismo enlace, así
// que también aplica a filas sincronizadas antes de este cambio.)
export const LEYLOBBY_INSTITUCIONES_URL = 'https://www.leylobby.gob.cl/instituciones';

/**
 * Convierte el CSV de InfoLobby en filas listas para la tabla lobby_audiencias.
 *
 * @param csvText      contenido del CSV
 * @param sinceMonths  si > 0, descarta audiencias anteriores a hace N meses
 * @param now          fecha de referencia (inyectable para tests deterministas)
 */
export function parseAudienciasCsv(
  csvText: string,
  sinceMonths = 0,
  now: Date = new Date(),
): NewLobbyAudiencia[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]).map((h) => clean(h).toLowerCase());
  const idx = (name: string): number => header.indexOf(name.toLowerCase());
  const col = {
    nombreActivo: idx('nombreActivo'),
    representado: idx('representado'),
    personalidad: idx('personalidad'),
    tipo: idx('tipo'),
    empresaLobby: idx('EmpresaLobby'),
    pasivo: idx('Pasivo'),
    organismo: idx('organismo'),
    cargo: idx('cargo'),
    anio: idx('anio'),
    mes: idx('mes'),
    dia: idx('dia'),
  };

  let cutoff: Date | null = null;
  if (sinceMonths > 0) {
    cutoff = new Date(now.getFullYear(), now.getMonth() - sinceMonths + 1, 1);
  }

  const rows: NewLobbyAudiencia[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i]).map(clean);
    const get = (c: number): string => (c >= 0 && c < f.length ? f[c] : '');

    const anio = Number(get(col.anio));
    const mes = Number(get(col.mes));
    const dia = Number(get(col.dia));
    if (!Number.isFinite(anio) || !anio || !Number.isFinite(mes) || !mes) continue;

    if (cutoff && new Date(anio, mes - 1, dia || 1) < cutoff) continue;

    const fecha = `${anio}-${pad2(mes)}-${pad2(dia || 1)}`;
    const nombreActivo = get(col.nombreActivo);
    const representado = get(col.representado);
    const empresaLobby = get(col.empresaLobby);
    const pasivo = get(col.pasivo);
    const organismo = get(col.organismo);
    const cargo = get(col.cargo);
    const tipo = get(col.tipo);
    const personalidad = get(col.personalidad);

    // El CSV no trae ID único: generamos uno estable para deduplicar re-syncs.
    const key = [fecha, nombreActivo, pasivo, organismo, representado].join('|').toLowerCase();
    const infolobbyId = createHash('sha1').update(key).digest('hex');
    if (seen.has(infolobbyId)) continue;
    seen.add(infolobbyId);

    const orgActivo = representado || empresaLobby || null;
    const searchText = [nombreActivo, orgActivo, pasivo, organismo, cargo]
      .filter(Boolean)
      .join(' ')
      .toLowerCase() || null;

    rows.push({
      infolobbyId,
      fecha,
      lugar: null,
      forma: null,
      tipoAudiencia: 'Audiencia',
      sujetoPasivo: pasivo || null,
      sujetoPasivoCargo: cargo || null,
      sujetoPasivoInstitucion: organismo || null,
      sujetoActivo: nombreActivo || null,
      sujetoActivoTipo: tipo || personalidad || null,
      sujetoActivoOrganizacion: orgActivo,
      materia: null,
      observaciones: null,
      searchText,
      sourceUrl: LEYLOBBY_INSTITUCIONES_URL,
      fetchedAt: new Date(),
    });
  }

  return rows;
}
