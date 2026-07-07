/**
 * Diagnóstico del lobby del Congreso (Cámara de Diputados y Senado).
 *
 * El lobby del Congreso NO está en InfoLobby: cada cámara lo publica en su
 * propio sitio. Estas páginas son .aspx (HTML), así que primero hay que
 * descubrir DE DÓNDE sale el dato real (un archivo CSV/Excel/XML descargable,
 * o una API que la página llama por detrás).
 *
 * Este script descarga cada página e imprime: estado HTTP, tipo de contenido,
 * tamaño, el <title>, y TODOS los enlaces/recursos que huelan a datos
 * (.csv .xls .xlsx .json .xml, "descargar", "opendata", "audiencia", "api").
 *
 * Uso:  bun run scripts/debug-congreso-lobby.ts
 *
 * Copia y pega TODA la salida. Si una página no muestra enlaces de datos,
 * probablemente carga la tabla por JavaScript: en ese caso, ábrela en tu
 * navegador, pulsa F12 → pestaña Network/Red, recarga, y cuéntame qué
 * llamadas aparecen (busca .json/.xml/.csv o /api/).
 */
export {};

const TARGETS = [
  { name: 'Cámara de Diputados', url: 'https://www.camara.cl/transparencia/ley_de_lobby.aspx' },
  { name: 'Senado', url: 'https://www.senado.cl/transparencia/lobby' },
  // Portales de datos abiertos del Congreso (por si exponen el lobby ahí)
  { name: 'OpenData Congreso (raíz)', url: 'https://opendata.congreso.cl/' },
  { name: 'OpenData Cámara (raíz)', url: 'https://opendata.camara.cl/' },
];

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim().replace(/\s+/g, ' ') : '(sin título)';
}

function extractDataLinks(html: string, base: string): string[] {
  const links = new Set<string>();
  const patterns = [
    /href\s*=\s*["']([^"']+)["']/gi,
    /src\s*=\s*["']([^"']+)["']/gi,
    /url\s*[:=]\s*["']([^"']+)["']/gi,
    /action\s*=\s*["']([^"']+)["']/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const raw = m[1];
      if (/\.(csv|xls|xlsx|json|xml)(\?|$)|descargar|download|opendata|audiencia|lobby|\/api\//i.test(raw)) {
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

async function probe(name: string, url: string): Promise<void> {
  console.log(`\n══ ${name} ══════════════════════════════════`);
  console.log(`URL: ${url}`);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'text/html,application/json,application/xml,*/*',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(30000),
    });
    console.log(`HTTP: ${res.status} ${res.statusText}`);
    console.log(`Content-Type: ${res.headers.get('content-type') ?? '(sin header)'}`);
    const text = await res.text();
    console.log(`Tamaño: ${text.length} caracteres`);
    console.log(`Título: ${extractTitle(text)}`);

    const links = extractDataLinks(text, url);
    if (links.length > 0) {
      console.log(`\nEnlaces/recursos que parecen de datos (${links.length}):`);
      links.slice(0, 40).forEach((l) => console.log(`  • ${l}`));
      if (links.length > 40) console.log(`  … y ${links.length - 40} más`);
    } else {
      console.log('\n⚠ No se encontraron enlaces de datos en el HTML.');
      console.log('  Probablemente la tabla se carga por JavaScript: usa F12 → Network.');
    }
  } catch (error) {
    console.log(`✗ Falló: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log('Diagnóstico del lobby del Congreso — copia y pega TODA esta salida.');
for (const t of TARGETS) {
  await probe(t.name, t.url);
}
console.log('\n══ Fin del diagnóstico ══');
