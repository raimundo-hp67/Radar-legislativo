import { describe, expect, test } from 'bun:test';
import { parseCamaraDate, parseCamaraAudiencias, CAMARA_INSTITUCION, CAMARA_LISTADO_URL } from './camara-lobby';

// Filas REALES capturadas de listadodeaudiencias.aspx (con la celda "Detalles"
// comentada, tal como la sirve el sitio de la Cámara).
const SAMPLE_HTML = `
<table>
<tr><th>Sujeto Pasivo</th><th>Fecha</th><th>Lobbista representado</th><th>Lugar</th><th>Materia</th><th>Detalles</th></tr>
<tr> <td> Marco Antonio Sulantay Olivares</td> <td> 07 jul. 2026</td> <td> EnfraGen Chile SpA </td> <td> Congreso Nacional Valparaíso, Región de Valparaíso</td> <td> Solicitamos una reunión a la brevedad para presentar a EnfraGen Chile. </td> <!-- <td style="text-align: center; cursor: pointer;"> <a onclick="abrirDetalle(28255)">ver</a></td>--> </tr>
<tr> <td> Jaime Bassa Mercado</td> <td> 07 jul. 2026</td> <td> Asociación Gremial Generadoras de Chile </td> <td> Av. Pedro Montt, S-N Valparaíso, Región de Valparaíso</td> <td> Proyecto de Ley Reforma SEIA; Proyecto de Ley Reactivación Economía</td> <!-- <td style="text-align: center; cursor: pointer;"> <a onclick="abrirDetalle(28336)">ver</a></td>--> </tr>
<tr> <td> Patricio Briones Moller</td> <td> 06 jun. 2025</td> <td> Hugo Rubio Celedon </td> <td> piso 10 oficina 9 Valparaíso, Región de Valparaíso</td> <td> Propuesta de proyecto de contaminación en el deporte</td> <!-- <td> <a onclick="abrirDetalle(11111)">ver</a></td>--> </tr>
</table>
`;

describe('parseCamaraDate', () => {
  test('convierte "07 jul. 2026" a ISO', () => {
    expect(parseCamaraDate('07 jul. 2026')).toBe('2026-07-07');
  });
  test('acepta meses sin punto y con día de un dígito', () => {
    expect(parseCamaraDate('6 jun 2025')).toBe('2025-06-06');
    expect(parseCamaraDate('01 dic. 2024')).toBe('2024-12-01');
  });
  test('devuelve null si no parsea', () => {
    expect(parseCamaraDate('sin fecha')).toBeNull();
  });
});

describe('parseCamaraAudiencias', () => {
  test('mapea las 5 columnas visibles al esquema', () => {
    const rows = parseCamaraAudiencias(SAMPLE_HTML);
    expect(rows).toHaveLength(3);

    const first = rows[0];
    expect(first.sujetoPasivo).toBe('Marco Antonio Sulantay Olivares');
    expect(first.fecha).toBe('2026-07-07');
    expect(first.sujetoActivoOrganizacion).toBe('EnfraGen Chile SpA');
    expect(first.lugar).toContain('Valparaíso');
    expect(first.materia).toContain('EnfraGen');
    expect(first.sujetoPasivoInstitucion).toBe(CAMARA_INSTITUCION);
    expect(first.sujetoPasivoCargo).toBe('Diputado/a');
    expect(first.tipoAudiencia).toBe('Audiencia');
    expect(first.sourceUrl).toBe(CAMARA_LISTADO_URL);
    expect(first.searchText).toContain('enfragen'); // minúsculas
  });

  test('usa el ID de abrirDetalle() como clave estable y única', () => {
    const rows = parseCamaraAudiencias(SAMPLE_HTML);
    expect(rows[0].infolobbyId).toBe('camara:28255');
    expect(rows[1].infolobbyId).toBe('camara:28336');
    // Reparsear da el mismo ID (idempotente para dedupe entre descargas).
    expect(parseCamaraAudiencias(SAMPLE_HTML)[0].infolobbyId).toBe('camara:28255');
  });

  test('ignora el encabezado (usa <th>, no <td>)', () => {
    const rows = parseCamaraAudiencias(SAMPLE_HTML);
    expect(rows.every((r) => r.sujetoPasivo !== 'Sujeto Pasivo')).toBe(true);
  });

  test('deduplica filas con el mismo ID de detalle', () => {
    const dup = SAMPLE_HTML.replace('</table>', `
      <tr> <td> Marco Antonio Sulantay Olivares</td> <td> 07 jul. 2026</td> <td> EnfraGen Chile SpA </td> <td> Congreso</td> <td> repetida</td> <!-- <a onclick="abrirDetalle(28255)">ver</a>--> </tr>
    </table>`);
    expect(parseCamaraAudiencias(dup)).toHaveLength(3);
  });

  test('sinceMonths descarta audiencias fuera de la ventana', () => {
    const now = new Date(2026, 6, 15); // julio 2026
    // Ventana de 1 mes → solo julio 2026 (2 filas); junio 2025 queda fuera.
    expect(parseCamaraAudiencias(SAMPLE_HTML, 1, now)).toHaveLength(2);
  });

  test('HTML sin filas de datos → sin resultados', () => {
    expect(parseCamaraAudiencias('<table><tr><th>x</th></tr></table>')).toEqual([]);
    expect(parseCamaraAudiencias('')).toEqual([]);
  });
});
