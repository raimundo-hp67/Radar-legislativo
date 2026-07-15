import { describe, expect, test } from 'bun:test';
import {
  parseSenadoPage,
  parseSenadoFecha,
  toLobbyAudiencia,
  isWithinMonths,
  SENADO_INSTITUCION,
} from './senado-lobby';

// Registro REAL capturado con scripts/debug-senado-lobby.ts (round 3, jul 2026)
// contra https://web-back.senado.cl/api/transparency/audiences.
const REAL_RECORD = {
  id: 137549,
  lugar: 'Senado ',
  region: 'Región de Valparaíso',
  comuna: 'Valparaíso',
  fecha: '2023-06-14T04:00:00.000000Z',
  hora: '16:00:00',
  duracion: 60,
  tipo_reunion: 'Presencial',
  reunion_o_audiencia: null,
  naturaleza_representacion: null,
  materia_tratada: 'La empresa de aplicación de transporte de pasajeros, Didi, solicita audiencia con la senadora Loreto Carvajal para exponer aspectos de interés…',
  boletin: null,
  observaciones: null,
  corresponde_lobby: null,
  id_solicitante: 649907,
  id_destinatario: 646437,
  id_solicitud_audiencia: 426404,
  created_at: '2024-06-26T19:54:23.839000Z',
  user_data: {
    id: 646437,
    name: 'Maria Loreto',
    lastname: 'Carvajal Ambiado',
    email: 'lcarvajal@senado.cl;loretovarvajala@gmail.com',
    rut: '123226771',
  },
  represented: ['Transporte'],
};

const REAL_ENVELOPE = {
  data: {
    audiencias: {
      current_page: 1,
      last_page: 795,
      total: 7947,
      data: [REAL_RECORD],
    },
  },
};

describe('parseSenadoPage', () => {
  test('extrae registros y paginación del envelope real', () => {
    const page = parseSenadoPage(REAL_ENVELOPE);
    expect(page).not.toBeNull();
    expect(page!.records).toHaveLength(1);
    expect(page!.currentPage).toBe(1);
    expect(page!.lastPage).toBe(795);
    expect(page!.total).toBe(7947);
  });

  test('devuelve null ante shapes inesperados', () => {
    expect(parseSenadoPage(null)).toBeNull();
    expect(parseSenadoPage({})).toBeNull();
    expect(parseSenadoPage({ data: { audiencias: { data: 'no-array' } } })).toBeNull();
  });
});

describe('parseSenadoFecha', () => {
  test('convierte el timestamp ISO de la API a YYYY-MM-DD', () => {
    expect(parseSenadoFecha('2023-06-14T04:00:00.000000Z')).toBe('2023-06-14');
  });

  test('null o basura → null', () => {
    expect(parseSenadoFecha(null)).toBeNull();
    expect(parseSenadoFecha('sin fecha')).toBeNull();
  });
});

describe('toLobbyAudiencia', () => {
  const row = toLobbyAudiencia(REAL_RECORD)!;

  test('mapea el registro real al shape de lobby_audiencias', () => {
    expect(row).not.toBeNull();
    expect(row.infolobbyId).toBe('senado:137549');
    expect(row.fecha).toBe('2023-06-14');
    expect(row.sujetoPasivo).toBe('Maria Loreto Carvajal Ambiado');
    expect(row.sujetoPasivoCargo).toBe('Senador/a');
    expect(row.sujetoPasivoInstitucion).toBe(SENADO_INSTITUCION);
    expect(row.sujetoActivoOrganizacion).toBe('Transporte');
    expect(row.forma).toBe('Presencial');
    expect(row.tipoAudiencia).toBe('Audiencia');
    expect(row.lugar).toBe('Senado, Valparaíso');
    expect(row.materia).toContain('Didi');
  });

  test('NO copia datos de contacto del parlamentario (email/RUT)', () => {
    const serialized = JSON.stringify(row);
    expect(serialized).not.toContain('lcarvajal@senado.cl');
    expect(serialized).not.toContain('123226771');
  });

  test('searchText permite encontrarla por senador, organización y materia', () => {
    expect(row.searchText).toContain('carvajal');
    expect(row.searchText).toContain('transporte');
    expect(row.searchText).toContain('didi');
    expect(row.searchText).toContain('senado');
  });

  test('sin id → null (no se puede deduplicar)', () => {
    expect(toLobbyAudiencia({} as never)).toBeNull();
  });

  test('boletín presente queda registrado en observaciones', () => {
    const conBoletin = toLobbyAudiencia({ ...REAL_RECORD, boletin: '17170-05' })!;
    expect(conBoletin.observaciones).toContain('Boletín: 17170-05');
  });
});

describe('isWithinMonths', () => {
  const now = new Date('2026-07-15T12:00:00Z');

  test('dentro y fuera de la ventana', () => {
    expect(isWithinMonths('2026-06-01', 24, now)).toBe(true);
    expect(isWithinMonths('2024-08-01', 24, now)).toBe(true);
    expect(isWithinMonths('2023-06-14', 24, now)).toBe(false);
    expect(isWithinMonths(null, 24, now)).toBe(false);
  });
});
