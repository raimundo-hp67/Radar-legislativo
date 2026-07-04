import { describe, expect, test } from 'bun:test';
import type { ProjectSnapshot } from '~/db/schema';
import type { ScrapedData } from './types';
import { diffSnapshots, hasSignificantChanges, formatChanges } from './diff-engine';

function makeSnapshot(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    id: 1,
    boletin: '17618-19',
    stage: 'Primer trámite constitucional',
    chamberCurrent: 'Senado',
    lastAction: 'Cuenta de proyecto',
    lastActionDate: '2026-06-01',
    urgency: 'Sin urgencia',
    commission: 'Hacienda',
    sourceProvider: 'senado_xml',
    sourceUrl: null,
    fetchedAt: new Date('2026-06-01T12:00:00Z'),
    changesDetected: null,
    ...overrides,
  } as ProjectSnapshot;
}

function makeScraped(overrides: Partial<ScrapedData> = {}): ScrapedData {
  return {
    stage: 'Primer trámite constitucional',
    chamberCurrent: 'Senado',
    lastAction: 'Cuenta de proyecto',
    lastActionDate: '2026-06-01',
    urgency: 'Sin urgencia',
    commission: 'Hacienda',
    sourceUrl: null,
    ...overrides,
  } as ScrapedData;
}

describe('diffSnapshots', () => {
  test('sin snapshot previo no reporta cambios (primera captura)', () => {
    expect(diffSnapshots(null, makeScraped())).toEqual([]);
  });

  test('valores idénticos no reportan cambios', () => {
    expect(diffSnapshots(makeSnapshot(), makeScraped())).toEqual([]);
  });

  test('detecta cambio de etapa con from/to', () => {
    const changes = diffSnapshots(
      makeSnapshot(),
      makeScraped({ stage: 'Segundo trámite constitucional' }),
    );
    expect(changes).toEqual([
      {
        field: 'stage',
        from: 'Primer trámite constitucional',
        to: 'Segundo trámite constitucional',
      },
    ]);
  });

  test('normaliza espacios y strings vacíos (no son cambios)', () => {
    const changes = diffSnapshots(
      makeSnapshot({ commission: '' }),
      makeScraped({ commission: null, stage: '  Primer trámite constitucional  ' }),
    );
    expect(changes).toEqual([]);
  });

  test('detecta múltiples cambios a la vez', () => {
    const changes = diffSnapshots(
      makeSnapshot(),
      makeScraped({ urgency: 'Suma', lastAction: 'Aprobado en general' }),
    );
    expect(changes).toHaveLength(2);
    expect(changes.map((c) => c.field).sort()).toEqual(['lastAction', 'urgency']);
  });
});

describe('hasSignificantChanges', () => {
  test('cambio de etapa es significativo', () => {
    expect(hasSignificantChanges([{ field: 'stage', from: 'a', to: 'b' }])).toBe(true);
  });

  test('cambio de urgencia es significativo', () => {
    expect(hasSignificantChanges([{ field: 'urgency', from: null, to: 'Suma' }])).toBe(true);
  });

  test('cambio solo de último trámite no es significativo', () => {
    expect(hasSignificantChanges([{ field: 'lastAction', from: 'a', to: 'b' }])).toBe(false);
  });
});

describe('formatChanges', () => {
  test('formatea con etiqueta legible y flecha', () => {
    expect(formatChanges([{ field: 'stage', from: 'Primer trámite', to: 'Segundo trámite' }]))
      .toEqual(['Estado/Etapa: Primer trámite → Segundo trámite']);
  });

  test('muestra ∅ para valores nulos', () => {
    expect(formatChanges([{ field: 'urgency', from: null, to: 'Suma' }]))
      .toEqual(['Urgencia: ∅ → Suma']);
  });
});
