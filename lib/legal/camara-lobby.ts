/**
 * Parser del lobby de la Cámara de Diputadas y Diputados.
 *
 * La Cámara publica TODAS sus audiencias de lobby como una tabla HTML en:
 *   https://www.camara.cl/transparencia/listadodeaudiencias.aspx
 * (~17.900 filas, la tabla viene entera en el HTML — no hay API ni paginación).
 *
 * Cada fila tiene 5 celdas visibles:
 *   Sujeto Pasivo | Fecha | Lobbista representado | Lugar | Materia
 * y una 6ª celda de "Detalles" que el sitio deja COMENTADA en el HTML con un
 * identificador único: <a onclick="abrirDetalle(28255)">ver</a>. Usamos ese ID
 * para deduplicar de forma estable entre descargas.
 *
 * Este módulo es PURO (sin red ni base de datos) para poder testearlo.
 */
import { createHash } from 'node:crypto';
import type { NewLobbyAudiencia } from '~/db/schema';

export const CAMARA_LISTADO_URL = 'https://www.camara.cl/transparencia/listadodeaudiencias.aspx';
export const CAMARA_INSTITUCION = 'CÁMARA DE DIPUTADAS Y DIPUTADOS';

// Meses abreviados como los escribe la Cámara ("07 jul. 2026").
const MESES: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12,
};

/** Limpia una celda HTML: quita etiquetas, decodifica entidades y colapsa espacios. */
function cleanCell(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&ntilde;/gi, 'ñ')
    .replace(/&quot;/gi, '"')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "07 jul. 2026" → "2026-07-07". Devuelve null si no parsea. */
export function parseCamaraDate(raw: string): string | null {
  const m = raw.toLowerCase().match(/(\d{1,2})\s+([a-záéíóú]+)\.?\s+(\d{4})/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = MESES[m[2].slice(0, 3)];
  const anio = Number(m[3]);
  if (!mes || !dia || !anio) return null;
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${anio}-${p2(mes)}-${p2(dia)}`;
}

/**
 * Convierte el HTML de listadodeaudiencias.aspx en filas de lobby_audiencias.
 *
 * @param html         HTML completo de la página
 * @param sinceMonths  si > 0, descarta audiencias anteriores a hace N meses
 * @param now          fecha de referencia (inyectable para tests deterministas)
 */
export function parseCamaraAudiencias(
  html: string,
  sinceMonths = 0,
  now: Date = new Date(),
): NewLobbyAudiencia[] {
  const trBlocks = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];

  let cutoff: Date | null = null;
  if (sinceMonths > 0) {
    cutoff = new Date(now.getFullYear(), now.getMonth() - sinceMonths + 1, 1);
  }

  const rows: NewLobbyAudiencia[] = [];
  const seen = new Set<string>();

  for (const tr of trBlocks) {
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => cleanCell(m[1]));
    // Filas de datos tienen 5 celdas visibles; el encabezado usa <th> (0 <td>).
    if (cells.length < 5) continue;

    const [sujetoPasivo, fechaRaw, representado, lugar, materia] = cells;
    const fecha = parseCamaraDate(fechaRaw);
    if (!fecha) continue;

    if (cutoff && new Date(fecha) < cutoff) continue;

    // El ID de detalle vive en un comentario: <a onclick="abrirDetalle(28255)">.
    const detalle = tr.match(/abrirDetalle\((\d+)\)/);
    const key = detalle
      ? `camara:${detalle[1]}`
      : `camara:${createHash('sha1').update([fecha, sujetoPasivo, representado, materia].join('|').toLowerCase()).digest('hex')}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const searchText = [sujetoPasivo, representado, lugar, materia, CAMARA_INSTITUCION]
      .filter(Boolean)
      .join(' ')
      .toLowerCase() || null;

    rows.push({
      infolobbyId: key,
      fecha,
      lugar: lugar || null,
      forma: null,
      tipoAudiencia: 'Audiencia',
      sujetoPasivo: sujetoPasivo || null,
      sujetoPasivoCargo: 'Diputado/a',
      sujetoPasivoInstitucion: CAMARA_INSTITUCION,
      sujetoActivo: null,
      sujetoActivoTipo: null,
      sujetoActivoOrganizacion: representado || null,
      materia: materia || null,
      observaciones: null,
      searchText,
      sourceUrl: CAMARA_LISTADO_URL,
      fetchedAt: new Date(),
    });
  }

  return rows;
}
