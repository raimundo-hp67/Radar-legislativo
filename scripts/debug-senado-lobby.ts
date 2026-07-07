/**
 * Diagnóstico del lobby del SENADO — sin DevTools.
 *
 * La página de registros de audiencias del Senado se arma con JavaScript y su
 * API (…&ac=GetReuniones) no devuelve nada útil si la llamamos "a secas".
 * En vez de pedirte que caces la llamada con F12, este script:
 *
 *   1. Descarga el HTML de la página de registros de audiencias.
 *   2. Baja los archivos JavaScript que carga esa página.
 *   3. Busca dentro de ellos CÓMO llama a la API (la URL exacta y sus
 *      parámetros: año, página, etc.) y te muestra ese trocito de código.
 *   4. De paso prueba la API directo (GET y POST, pidiendo JSON) y prueba el
 *      subdominio lobby.senado.cl.
 *
 * Uso:  bun run scripts/debug-senado-lobby.ts
 * Copia y pega TODA la salida (aunque parezca código raro, eso es justo lo que
 * necesito).
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
function showAround(code: string, needle: string, radius = 300): number {
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
    if (count >= 6) {
      console.log('    (más apariciones omitidas)');
      break;
    }
  }
  return count;
}

// ── 1 + 2 + 3: bajar la página, sus JS y buscar la llamada a la API ──────────
async function inspectFrontend(): Promise<void> {
  console.log('\n══ 1) Código de la página del Senado ══════════════════════');
  console.log(`URL: ${PAGE}`);
  let html = '';
  try {
    const res = await get(PAGE);
    console.log(`HTTP: ${res.status} ${res.statusText}`);
    html = await res.text();
    console.log(`Tamaño HTML: ${html.length} caracteres`);
  } catch (e) {
    console.log(`✗ No se pudo bajar la página: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  // Extraer los <script src="/_next/…js"> y otros .js
  const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+\.js[^"']*)["']/gi)].map((m) => m[1]);
  const jsUrls = [...new Set(scripts)]
    .map((s) => {
      try {
        return new URL(s, PAGE).href;
      } catch {
        return null;
      }
    })
    .filter((u): u is string => Boolean(u));

  console.log(`\nArchivos JavaScript que carga la página: ${jsUrls.length}`);
  jsUrls.slice(0, 30).forEach((u) => console.log(`  • ${u}`));

  console.log('\n══ 2) Buscando la llamada a la API dentro del JavaScript ══');
  const needles = ['GetReuniones', 'getReuniones', 'appsenado', 'tramitacion.senado', 'lobby.senado', 'GetAudiencia', 'audiencia'];
  let anyHit = false;
  for (const url of jsUrls) {
    let code = '';
    try {
      const res = await get(url);
      if (!res.ok) continue;
      code = await res.text();
    } catch {
      continue;
    }
    for (const needle of needles) {
      if (code.toLowerCase().includes(needle.toLowerCase())) {
        console.log(`\n── En ${url}`);
        console.log(`   contiene "${needle}":`);
        const n = showAround(code, needle);
        if (n > 0) anyHit = true;
        break; // con un needle por archivo basta para ubicarlo
      }
    }
  }
  if (!anyHit) {
    console.log('\n⚠ No encontré la llamada en el JavaScript (puede venir de otro chunk).');
  }
}

// ── 4: probar la API directo, de varias formas ───────────────────────────────
async function tryApi(): Promise<void> {
  console.log('\n══ 3) Probando la API del Senado directo ══════════════════');
  const base = 'https://tramitacion.senado.cl/appsenado/index.php';
  const candidates: Array<{ label: string, url: string, init?: RequestInit }> = [
    { label: 'GET GetReuniones + Accept JSON', url: `${base}?mo=lobby&ac=GetReuniones`, init: { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } } },
    { label: 'POST GetReuniones', url: `${base}?mo=lobby&ac=GetReuniones`, init: { method: 'POST', headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'draw=1&start=0&length=25' } },
    { label: 'GET GetReuniones + año actual', url: `${base}?mo=lobby&ac=GetReuniones&anno=2026`, init: { headers: { Accept: 'application/json' } } },
    { label: 'lobby.senado.cl audiencia.php', url: 'https://lobby.senado.cl/public_html/forms/masters-senado/audiencia.php', init: { headers: { Accept: 'application/json' } } },
  ];

  for (const c of candidates) {
    console.log(`\n── ${c.label}`);
    console.log(`   ${c.init?.method ?? 'GET'} ${c.url}`);
    try {
      const res = await get(c.url, c.init);
      const ct = res.headers.get('content-type') ?? '(sin header)';
      const text = await res.text();
      console.log(`   HTTP ${res.status} · ${ct} · ${text.length} caracteres`);
      const head = text.trimStart().slice(0, 1);
      if (head === '{' || head === '[') {
        console.log('   ✓ ¡Parece JSON! Primeros 800 caracteres:');
        console.log(`   ${text.slice(0, 800)}`);
      } else {
        console.log('   Primeros 200 caracteres (no-JSON):');
        console.log(`   ${text.slice(0, 200).replace(/\s+/g, ' ').trim()}`);
      }
    } catch (e) {
      console.log(`   ✗ ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

console.log('Diagnóstico del lobby del SENADO — copia y pega TODA esta salida.');
await inspectFrontend();
await tryApi();
console.log('\n══ Fin del diagnóstico ══');
