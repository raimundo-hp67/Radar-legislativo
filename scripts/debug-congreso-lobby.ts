/**
 * Diagnóstico del lobby del Congreso — RONDA 2 (drill-down).
 *
 * La ronda 1 nos dijo:
 *   • Senado (https://www.senado.cl/transparencia/lobby) responde 200 y enlaza a
 *       /transparencia/lobby/registros-de-audiencias  y  /transparencia/lobby/audiencia
 *     …pero todavía no sabemos el FORMATO del dato real detrás de esas páginas.
 *   • Cámara (https://www.camara.cl/transparencia/ley_de_lobby.aspx) responde 403
 *     con Cloudflare → un `fetch` simple no sirve; hay que ir por el servicio de
 *     datos abiertos (opendata.camara.cl) o inspeccionar el navegador.
 *
 * Esta ronda:
 *   1. Entra a los sub-endpoints concretos del Senado e imprime un TROZO del
 *      cuerpo + detecta si es HTML-tabla, JSON o XML, y saca enlaces/recursos
 *      más profundos (paginación, /api/, .asmx, .json, descargas).
 *   2. Prueba el listado de servicios de datos abiertos de la Cámara.
 *
 * Uso:  bun run scripts/debug-congreso-lobby.ts
 *
 * Copia y pega TODA la salida.
 *
 * Si una página del Senado NO muestra el dato en el HTML (se arma por
 * JavaScript), ábrela en tu navegador, pulsa F12 → pestaña Network/Red,
 * recarga, filtra por "Fetch/XHR" y cuéntame qué llamadas aparecen (busca
 * .json / .xml / .aspx / /api/). Para la Cámara haz lo mismo en
 * https://www.camara.cl/transparencia/ley_de_lobby.aspx
 */
export {};

const TARGETS = [
  // — Senado: los sub-endpoints que descubrimos en la ronda 1 —
  { name: 'Senado · registros-de-audiencias', url: 'https://www.senado.cl/transparencia/lobby/registros-de-audiencias' },
  { name: 'Senado · audiencia', url: 'https://www.senado.cl/transparencia/lobby/audiencia' },
  // — Cámara: las páginas REALES de audiencias que salieron en la ronda 1
  //   (el fetch a camara.cl a veces pasa Cloudflare y a veces no; reintenta) —
  { name: 'Cámara · listadodeaudiencias', url: 'https://www.camara.cl/transparencia/listadodeaudiencias.aspx' },
  { name: 'Cámara · audiencias', url: 'https://www.camara.cl/transparencia/audiencias.aspx' },
];

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim().replace(/\s+/g, ' ') : '(sin título)';
}

/** ¿El cuerpo parece JSON, XML o HTML? */
function sniffFormat(contentType: string, body: string): string {
  const ct = contentType.toLowerCase();
  const head = body.trimStart().slice(0, 200);
  if (ct.includes('json') || head.startsWith('{') || head.startsWith('[')) return 'JSON';
  if (ct.includes('xml') || head.startsWith('<?xml') || /^<(rss|feed|soap|wsdl|dataset)/i.test(head)) return 'XML';
  if (ct.includes('csv')) return 'CSV';
  if (/<table[\s>]/i.test(body)) return 'HTML con <table> (tabla en el HTML — se puede parsear)';
  if (/<html[\s>]/i.test(head) || ct.includes('html')) return 'HTML (sin <table> visible → probablemente se arma por JavaScript)';
  return 'desconocido';
}

/** Cuenta filas de tabla y celdas de encabezado, para saber si el dato está en el HTML. */
function tableStats(html: string): string {
  const rows = (html.match(/<tr[\s>]/gi) || []).length;
  const headers = [...html.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 12);
  if (rows === 0) return 'sin <tr> (no hay tabla en el HTML)';
  return `${rows} <tr> · encabezados: ${headers.length ? headers.join(' | ') : '(sin <th>)'}`;
}

function extractDataLinks(html: string, base: string): string[] {
  const links = new Set<string>();
  const patterns = [
    /href\s*=\s*["']([^"']+)["']/gi,
    /src\s*=\s*["']([^"']+)["']/gi,
    /url\s*[:=]\s*["']([^"']+)["']/gi,
    /action\s*=\s*["']([^"']+)["']/gi,
    /fetch\s*\(\s*["'`]([^"'`]+)["'`]/gi,
    /["'`](\/[^"'`\s]*(?:api|audiencia|lobby|registro)[^"'`\s]*)["'`]/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const raw = m[1];
      if (/\.(csv|xls|xlsx|json|xml|asmx|svc|wsdl)(\?|$)|descargar|download|opendata|audiencia|lobby|registro|\/api\//i.test(raw)) {
        try {
          links.add(new URL(raw, base).href);
        } catch {
          links.add(raw);
        }
      }
    }
  }
  return [...links];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Descarga con reintentos: camara.cl a veces devuelve 403 (Cloudflare) y pasa al reintentar. */
async function fetchWithRetry(url: string, attempts = 4): Promise<Response> {
  let last: Response | null = null;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, {
      headers: {
        Accept: 'text/html,application/json,application/xml,*/*',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      },
      signal: AbortSignal.timeout(30000),
    });
    if (res.status !== 403) return res;
    last = res;
    if (i < attempts - 1) {
      console.log(`  (intento ${i + 1}: 403 Cloudflare, reintentando…)`);
      await sleep(1500 * (i + 1));
    }
  }
  return last as Response;
}

async function probe(name: string, url: string): Promise<void> {
  console.log(`\n══ ${name} ══════════════════════════════════`);
  console.log(`URL: ${url}`);
  try {
    const res = await fetchWithRetry(url);
    const ct = res.headers.get('content-type') ?? '(sin header)';
    console.log(`HTTP: ${res.status} ${res.statusText}`);
    console.log(`Content-Type: ${ct}`);
    const text = await res.text();
    console.log(`Tamaño: ${text.length} caracteres`);
    console.log(`Título: ${extractTitle(text)}`);
    console.log(`Formato detectado: ${sniffFormat(ct, text)}`);
    console.log(`Tabla: ${tableStats(text)}`);

    console.log('\n── Primeros 600 caracteres del cuerpo ──');
    console.log(text.slice(0, 600).replace(/\s+/g, ' ').trim());

    const links = extractDataLinks(text, url);
    if (links.length > 0) {
      console.log(`\nEnlaces/recursos que parecen de datos (${links.length}):`);
      links.slice(0, 40).forEach((l) => console.log(`  • ${l}`));
      if (links.length > 40) console.log(`  … y ${links.length - 40} más`);
    } else {
      console.log('\n⚠ No se encontraron enlaces de datos en el HTML.');
    }
  } catch (error) {
    console.log(`✗ Falló: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log('Diagnóstico del lobby del Congreso (ronda 2) — copia y pega TODA esta salida.');
for (const t of TARGETS) {
  await probe(t.name, t.url);
}
console.log('\n══ Fin del diagnóstico ══');
console.log('\nSi el Senado NO trae la tabla en el HTML (dice "se arma por JavaScript"),');
console.log('abre la página en el navegador → F12 → Network/Red → filtra "Fetch/XHR" →');
console.log('recarga, y cuéntame qué URL .json/.xml/.aspx aparece. Igual para la Cámara.');
