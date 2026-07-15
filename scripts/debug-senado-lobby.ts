/**
 * Diagnóstico del lobby del SENADO — round 2 (sin DevTools).
 *
 * El round 1 confirmó que la página es una app Next.js que llama a una API
 * con parámetros per_page/page, pero el trozo de código capturado no alcanzó
 * a mostrar la URL BASE de esa API. Este round:
 *
 *   1. Descarga el HTML de la página de registros de audiencias.
 *   2. Baja TODOS los archivos JavaScript que carga.
 *   3. Extrae de ellos las URLs/endpoints (https://…, "/api/…", baseURL:…)
 *      y todos los trozos donde se arma la llamada (per_page, registros,
 *      audiencia, reuniones).
 *   4. Prueba directamente los endpoints candidatos que encuentre y muestra
 *      el inicio de la respuesta (para confirmar cuál devuelve JSON).
 *
 * Uso:  bun run scripts/debug-senado-lobby.ts
 * Copia y pega TODA la salida.
 */
export {};

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const PAGE = 'https://www.senado.cl/transparencia/lobby/registros-de-audiencias';

async function get(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    headers: { 'User-Agent': UA, Accept: '*/*', ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(30000),
    ...init,
  });
}

/** Imprime cada aparición de una palabra clave con el código que la rodea. */
function showAround(code: string, needle: string, radius = 400, max = 4): number {
  let count = 0;
  let from = 0;
  const lower = code.toLowerCase();
  const key = needle.toLowerCase();
  while (true) {
    const idx = lower.indexOf(key, from);
    if (idx === -1) break;
    count++;
    const start = Math.max(0, idx - radius);
    const end = Math.min(code.length, idx + needle.length + radius);
    console.log(`\n    …${code.slice(start, end)}…`);
    from = idx + needle.length;
    if (count >= max) {
      console.log('    (más apariciones omitidas)');
      break;
    }
  }
  return count;
}

console.log('Diagnóstico del lobby del SENADO (round 2) — copia y pega TODA esta salida.\n');

// ── 1. Página + lista de chunks JS ─────────────────────────────────────────
console.log('══ 1) Descargando página y sus archivos JavaScript ═══════');
const pageRes = await get(PAGE, { headers: { Accept: 'text/html' } });
console.log(`Página: HTTP ${pageRes.status}`);
const html = await pageRes.text();

const scriptUrls = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)]
  .map((m) => (m[1].startsWith('http') ? m[1] : `https://www.senado.cl${m[1]}`))
  .filter((u, i, arr) => arr.indexOf(u) === i);
console.log(`Chunks JS encontrados: ${scriptUrls.length}`);

// ── 2. Descargar chunks y extraer URLs/endpoints ───────────────────────────
console.log('\n══ 2) URLs y endpoints dentro del JavaScript ═════════════');

const absoluteUrls = new Set<string>();
const apiPaths = new Set<string>();
const baseUrlDefs = new Set<string>();
const chunks: Array<{ url: string, code: string }> = [];

for (const url of scriptUrls) {
  try {
    const res = await get(url);
    if (!res.ok) {
      console.log(`  ⚠ ${url} → HTTP ${res.status}`);
      continue;
    }
    const code = await res.text();
    chunks.push({ url, code });

    // URLs absolutas (filtramos las de librerías/licencias)
    for (const m of code.matchAll(/https?:\/\/[a-zA-Z0-9.-]+\.(?:cl|com|net|org)[^"'`\\ )]*/g)) {
      const u = m[0];
      if (/senado|lobby|api|back/i.test(u) && !/w3\.org|reactjs|nextjs|github|google|facebook|twitter/i.test(u)) {
        absoluteUrls.add(u);
      }
    }
    // Rutas relativas de API ("/api/...", "/jsonapi/...", etc.)
    for (const m of code.matchAll(/["'`](\/(?:api|jsonapi|backend|rest)\/[^"'`]{3,120})["'`]/g)) {
      apiPaths.add(m[1]);
    }
    // Definiciones de baseURL / NEXT_PUBLIC / env embebido
    for (const m of code.matchAll(/(?:baseURL|BASE_URL|API_URL|apiUrl|backendUrl|NEXT_PUBLIC_[A-Z_]+)["']?\s*[:=]\s*["']([^"']{4,160})["']/g)) {
      baseUrlDefs.add(m[0].slice(0, 200));
    }
  } catch (e) {
    console.log(`  ⚠ ${url} → ${e instanceof Error ? e.message : e}`);
  }
}

console.log('\n— URLs absolutas relevantes encontradas:');
for (const u of [...absoluteUrls].slice(0, 40)) console.log(`  • ${u}`);
if (absoluteUrls.size === 0) console.log('  (ninguna)');

console.log('\n— Rutas de API relativas encontradas:');
for (const p of [...apiPaths].slice(0, 40)) console.log(`  • ${p}`);
if (apiPaths.size === 0) console.log('  (ninguna)');

console.log('\n— Definiciones de baseURL / env embebidas:');
for (const d of baseUrlDefs) console.log(`  • ${d}`);
if (baseUrlDefs.size === 0) console.log('  (ninguna)');

// ── 3. Contexto de las llamadas (per_page / registros / audiencias) ───────
console.log('\n══ 3) Cómo se arma la llamada (contexto de código) ═══════');
for (const needle of ['per_page', 'audiencias?', 'reuniones?', 'registros', 'fetch(', 'axios']) {
  let shown = false;
  for (const { url, code } of chunks) {
    if (!code.toLowerCase().includes(needle.toLowerCase())) continue;
    // Solo mostramos el chunk más relevante por needle para no inundar
    console.log(`\n── "${needle}" en ${url.split('/').pop()}:`);
    showAround(code, needle, 350, needle === 'per_page' ? 6 : 2);
    shown = true;
    break;
  }
  if (!shown) console.log(`\n── "${needle}": no aparece en ningún chunk`);
}

// ── 4. Probar endpoints candidatos ─────────────────────────────────────────
console.log('\n══ 4) Probando endpoints candidatos ══════════════════════');

const candidates = new Set<string>();
for (const u of absoluteUrls) {
  if (/audienc|reunion|lobby|registro/i.test(u)) candidates.add(u);
}
// Combinar bases absolutas con rutas de API que suenen a audiencias
const bases = [...absoluteUrls]
  .filter((u) => /api|back/i.test(u))
  .map((u) => new URL(u).origin);
for (const base of new Set(bases)) {
  for (const p of apiPaths) {
    if (/audienc|reunion|lobby|registro|pasivo/i.test(p)) candidates.add(`${base}${p}`);
  }
}
// Siempre probar también las rutas relativas contra www.senado.cl
for (const p of apiPaths) {
  if (/audienc|reunion|lobby|registro|pasivo/i.test(p)) candidates.add(`https://www.senado.cl${p}`);
}

if (candidates.size === 0) {
  console.log('(no se encontraron candidatos que probar — revisar la sección 2/3)');
}

for (const url of [...candidates].slice(0, 12)) {
  try {
    const sep = url.includes('?') ? '&' : '?';
    const testUrl = `${url}${sep}per_page=5&page=1`;
    const res = await get(testUrl, { headers: { Accept: 'application/json' } });
    const type = res.headers.get('content-type') ?? '?';
    const body = await res.text();
    console.log(`\n── GET ${testUrl}`);
    console.log(`   HTTP ${res.status} · ${type} · ${body.length} caracteres`);
    console.log(`   Inicio: ${body.slice(0, 300).replace(/\s+/g, ' ')}`);
  } catch (e) {
    console.log(`\n── GET ${url}\n   ✗ ${e instanceof Error ? e.message : e}`);
  }
}

console.log('\n══ Fin del diagnóstico (round 2) ══');
