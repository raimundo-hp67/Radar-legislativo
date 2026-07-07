import { describe, expect, test } from 'bun:test';
import { parseCsvLine, parseAudienciasCsv } from './infolobby-csv';

// Encabezado + filas REALES capturadas de la fuente (dataset-audiencias.csv).
const SAMPLE_CSV = [
  '"nombreActivo","representado","personalidad","tipo","EmpresaLobby","Pasivo","organismo","cargo","anio","mes","dia","cantidadAudiencias"',
  '"Gonzalo Pinto-aguero","P-A Services SpA","Con Personalidad Juridica","Gestor","P-A Services SpA","Miguel Stange","FUERZA AÉREA DE CHILE","Encargado de adquisiciones en las Fuerzas Armadas y de Orden y Seguridad Pública",2026,4,9,1',
  '"Héctor Antonio Ponce Ponce","raul cepeda","Con Personalidad Juridica","Gestor","HABITA INMOBILIARIA","Maximiliano Barrionuevo","SUBSECRETARIA DE VIVIENDA Y URBANISMO","Secretario regional ministerial",2026,4,28,2',
  '"Fernando Fondon","Inmobiliaria Parque Buin SPA","Con Personalidad Juridica","Gestor","Ninhue Desarrollo Inmobiliario SpA","Miguel Araya","MUNICIPALIDAD DE BUIN","Alcalde",2026,4,28,1',
].join('\n');

describe('parseCsvLine', () => {
  test('respeta comas dentro de comillas', () => {
    expect(parseCsvLine('"a,b","c",1')).toEqual(['a,b', 'c', '1']);
  });
});

describe('parseAudienciasCsv', () => {
  test('mapea las columnas reales al esquema de la base', () => {
    const rows = parseAudienciasCsv(SAMPLE_CSV);
    expect(rows).toHaveLength(3);

    const first = rows[0];
    expect(first.sujetoActivo).toBe('Gonzalo Pinto-aguero');
    expect(first.sujetoActivoOrganizacion).toBe('P-A Services SpA');
    expect(first.sujetoActivoTipo).toBe('Gestor');
    expect(first.sujetoPasivo).toBe('Miguel Stange');
    expect(first.sujetoPasivoInstitucion).toBe('FUERZA AÉREA DE CHILE');
    expect(first.sujetoPasivoCargo).toContain('adquisiciones');
    expect(first.fecha).toBe('2026-04-09');
    expect(first.tipoAudiencia).toBe('Audiencia');
    // El search_text junta los campos en minúscula para el buscador
    expect(first.searchText).toContain('fuerza aérea de chile');
  });

  test('genera un ID estable (mismo input → mismo ID) para deduplicar', () => {
    const a = parseAudienciasCsv(SAMPLE_CSV);
    const b = parseAudienciasCsv(SAMPLE_CSV);
    expect(a[0].infolobbyId).toBe(b[0].infolobbyId);
    expect(a[0].infolobbyId).not.toBe(a[1].infolobbyId);
    expect(a[0].infolobbyId.length).toBeGreaterThan(0);
  });

  test('deduplica filas idénticas dentro del mismo CSV', () => {
    const withDup = `${SAMPLE_CSV}\n"Gonzalo Pinto-aguero","P-A Services SpA","Con Personalidad Juridica","Gestor","P-A Services SpA","Miguel Stange","FUERZA AÉREA DE CHILE","Encargado de adquisiciones en las Fuerzas Armadas y de Orden y Seguridad Pública",2026,4,9,1`;
    expect(parseAudienciasCsv(withDup)).toHaveLength(3);
  });

  test('sinceMonths descarta audiencias anteriores a la ventana', () => {
    // Referencia: julio 2026. Ventana de 1 mes → solo julio 2026; las filas
    // de abril 2026 quedan fuera.
    const now = new Date(2026, 6, 15); // julio (mes 6 = índice)
    expect(parseAudienciasCsv(SAMPLE_CSV, 1, now)).toHaveLength(0);
    // Ventana de 6 meses (feb–jul 2026) → las 3 filas de abril entran.
    expect(parseAudienciasCsv(SAMPLE_CSV, 6, now)).toHaveLength(3);
  });

  test('CSV vacío o solo encabezado → sin filas', () => {
    expect(parseAudienciasCsv('')).toEqual([]);
    expect(parseAudienciasCsv(SAMPLE_CSV.split('\n')[0])).toEqual([]);
  });
});
