/**
 * Diagnóstico del lobby del SENADO — round 3 (el último).
 *
 * El round 2 encontró la API real y CONFIRMÓ que responde JSON:
 *   https://web-back.senado.cl/api/transparency/audiences?per_page=5&page=1
 *
 * Lo único que falta para construir el sincronizador:
 *   1. Ver UN registro COMPLETO (todos sus campos: quién recibió, quién
 *      gestionó, materia, etc.) — el round 2 solo mostró los primeros 300
 *      caracteres.
 *   2. Ver los metadatos de paginación (¿cuántas páginas hay? ¿el orden es
 *      del más antiguo al más nuevo?).
 *   3. Ver si acepta filtro por año (para bajar solo lo reciente).
 *
 * Uso:  bun run scripts/debug-senado-lobby.ts
 * Copia y pega TODA la salida.
 */
export {};

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const API = 'https://web-back.senado.cl/api/transparency/audiences';

async function getJson(url: string): Promise<{ status: number, json: unknown } | { status: number, error: string }> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    try {
      return { status: res.status, json: JSON.parse(text) };
    } catch {
      return { status: res.status, error: `no-JSON: ${text.slice(0, 150).replace(/\s+/g, ' ')}` };
    }
  } catch (e) {
    return { status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

function pick(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

console.log('Diagnóstico del lobby del SENADO (round 3) — copia y pega TODA esta salida.\n');

// ── 1. Registro completo + metadatos de paginación ─────────────────────────
console.log('══ 1) Un registro COMPLETO y la paginación ═══════════════');
const first = await getJson(`${API}?per_page=2&page=1`);
if ('error' in first) {
  console.log(`✗ ${first.status}: ${first.error}`);
} else {
  const aud = pick(first.json, ['data', 'audiencias']) as Record<string, unknown> | undefined;
  if (!aud) {
    console.log('Respuesta con forma inesperada; JSON completo:');
    console.log(JSON.stringify(first.json).slice(0, 3000));
  } else {
    const { data, ...pagination } = aud;
    console.log('— Metadatos de paginación:');
    console.log(JSON.stringify(pagination, null, 2).slice(0, 1500));
    const rows = Array.isArray(data) ? data : [];
    console.log(`\n— Registro completo (1 de ${rows.length} de la página):`);
    console.log(JSON.stringify(rows[0] ?? null, null, 2).slice(0, 6000));
  }
}

// ── 2. Orden: comparar fechas de la primera y la última página ─────────────
console.log('\n══ 2) ¿En qué orden vienen? (primera vs última página) ═══');
const lastPage = Number(pick((first as { json?: unknown }).json, ['data', 'audiencias', 'last_page']) ?? 0);
console.log(`last_page reportado: ${lastPage}`);
if (lastPage > 1) {
  const last = await getJson(`${API}?per_page=2&page=${lastPage}`);
  if ('json' in last) {
    const rows = pick(last.json, ['data', 'audiencias', 'data']);
    const fechas = Array.isArray(rows) ? rows.map((r) => (r as Record<string, unknown>).fecha) : [];
    console.log(`Fechas en la ÚLTIMA página: ${JSON.stringify(fechas)}`);
  } else {
    console.log(`✗ ${last.status}: ${last.error}`);
  }
}

// ── 3. ¿Filtro por año / fecha? ─────────────────────────────────────────────
console.log('\n══ 3) Probando filtros de año/fecha ══════════════════════');
const candidates = [
  `${API}?per_page=2&page=1&year=2026`,
  `${API}?per_page=2&page=1&ano=2026`,
  `${API}?per_page=2&page=1&anno=2026`,
  `${API}?per_page=2&page=1&fecha_desde=2026-01-01`,
  `${API}?per_page=2&page=1&sort=-fecha`,
  `${API}?per_page=2&page=1&order=desc`,
  'https://web-back.senado.cl/api/transparency/available-periods?pagination[limit]=500&filters[endpoint][$eq]=audiences',
];
for (const url of candidates) {
  const res = await getJson(url);
  if ('error' in res) {
    console.log(`\n── ${url}\n   ✗ ${res.status}: ${res.error}`);
    continue;
  }
  const rows = pick(res.json, ['data', 'audiencias', 'data']);
  if (Array.isArray(rows)) {
    const fechas = rows.map((r) => (r as Record<string, unknown>).fecha);
    const total = pick(res.json, ['data', 'audiencias', 'total']);
    console.log(`\n── ${url}\n   HTTP ${res.status} · total=${total} · fechas página 1: ${JSON.stringify(fechas)}`);
  } else {
    console.log(`\n── ${url}\n   HTTP ${res.status} · respuesta: ${JSON.stringify(res.json).slice(0, 700)}`);
  }
}

console.log('\n══ Fin del diagnóstico (round 3) ══');
