/**
 * Diagnóstico del lobby del Congreso — RONDA 3 (formato exacto).
 *
 * Lo que ya sabemos:
 *   • CÁMARA: https://www.camara.cl/transparencia/listadodeaudiencias.aspx
 *       trae la TABLA COMPLETA en el HTML (~17.878 filas). Columnas:
 *       Sujeto Pasivo | Fecha | Lobbista representado | Lugar | Materia | Detalles
 *       → parseable directo. Solo falta ver la estructura real de una fila
 *         (formato de fecha y el enlace de "Detalles").
 *   • SENADO: la página se arma por JavaScript, pero filtró su API real:
 *       https://tramitacion.senado.cl/appsenado/index.php?mo=lobby&ac=GetReuniones
 *       → falta ver QUÉ devuelve (JSON, XML…) y con qué campos.
 *
 * Esta ronda:
 *   1. Llama la API del Senado (GetReuniones) e imprime formato + un trozo
 *      del cuerpo; si es JSON, cuenta registros y muestra el 1er objeto.
 *   2. Descarga la tabla de la Cámara e imprime las primeras filas: las
 *      celdas ya limpias Y el HTML crudo de 2 filas (para ver el <a> de
 *      "Detalles" con su enlace al registro puntual).
 *
 * Uso:  bun run scripts/debug-congreso-lobby.ts
 * Copia y pega TODA la salida.
 */
export {};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

/** Descarga con reintentos: camara.cl a veces devuelve 403 (Cloudflare) y pasa al reintentar. */
async function fetchWithRetry(url: string, attempts = 4): Promise<Response> {
  let last: Response | null = null;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json,text/html,application/xml,*/*',
        'User-Agent': UA,
        'X-Requested-With': 'XMLHttpRequest',
      },
      signal: AbortSignal.timeout(60000),
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

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&aacute;/gi, 'á')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────
// 1. SENADO — API GetReuniones
// ─────────────────────────────────────────────────────────────────────────
async function probeSenadoApi(): Promise<void> {
  const url = 'https://tramitacion.senado.cl/appsenado/index.php?mo=lobby&ac=GetReuniones';
  console.log('\n══ SENADO · API GetReuniones ══════════════════════════════');
  console.log(`URL: ${url}`);
  try {
    const res = await fetchWithRetry(url);
    const ct = res.headers.get('content-type') ?? '(sin header)';
    console.log(`HTTP: ${res.status} ${res.statusText}`);
    console.log(`Content-Type: ${ct}`);
    const text = await res.text();
    console.log(`Tamaño: ${text.length} caracteres`);

    const head = text.trimStart().slice(0, 1);
    if (head === '{' || head === '[') {
      try {
        const data = JSON.parse(text);
        const arr = Array.isArray(data) ? data : (data.data ?? data.reuniones ?? data.result ?? null);
        if (Array.isArray(arr)) {
          console.log(`✓ JSON con ${arr.length} registros.`);
          console.log('\nPRIMER registro (campos disponibles):');
          console.log(JSON.stringify(arr[0], null, 2).slice(0, 1200));
          if (arr[1]) {
            console.log('\nSEGUNDO registro (para confirmar campos):');
            console.log(JSON.stringify(arr[1], null, 2).slice(0, 1200));
          }
        } else {
          console.log('✓ JSON (no es un array directo). Estructura de nivel superior:');
          console.log(JSON.stringify(data, null, 2).slice(0, 1500));
        }
      } catch (e) {
        console.log('⚠ Parece JSON pero no parseó:', e instanceof Error ? e.message : String(e));
        console.log('\nPrimeros 1500 caracteres:');
        console.log(text.slice(0, 1500));
      }
    } else {
      console.log('Formato: NO-JSON. Primeros 1500 caracteres:');
      console.log(text.slice(0, 1500));
    }
  } catch (error) {
    console.log(`✗ Falló: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 2. CÁMARA — tabla HTML de listadodeaudiencias.aspx
// ─────────────────────────────────────────────────────────────────────────
async function probeCamaraTable(): Promise<void> {
  const url = 'https://www.camara.cl/transparencia/listadodeaudiencias.aspx';
  console.log('\n══ CÁMARA · listadodeaudiencias (muestra de filas) ═════════');
  console.log(`URL: ${url}`);
  try {
    const res = await fetchWithRetry(url);
    console.log(`HTTP: ${res.status} ${res.statusText}`);
    const html = await res.text();
    console.log(`Tamaño: ${html.length} caracteres`);

    const rows = [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => m[0]);
    console.log(`Total de <tr>: ${rows.length}`);

    // Buscamos la primera fila con celdas de datos (varias <td>).
    const dataRows = rows.filter((r) => (r.match(/<td[\s>]/gi) || []).length >= 3);
    console.log(`Filas con datos (≥3 <td>): ${dataRows.length}`);

    console.log('\n── Primeras 5 filas, celdas ya limpias ──');
    dataRows.slice(0, 5).forEach((r, i) => {
      const cells = [...r.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => stripTags(m[1]));
      console.log(`  [${i + 1}] ${cells.map((c) => c || '∅').join('  |  ')}`);
    });

    console.log('\n── HTML CRUDO de las primeras 2 filas (para ver el enlace de "Detalles") ──');
    dataRows.slice(0, 2).forEach((r, i) => {
      console.log(`\n  ▼ fila ${i + 1}:`);
      console.log(r.replace(/\s+/g, ' ').trim().slice(0, 1500));
    });
  } catch (error) {
    console.log(`✗ Falló: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log('Diagnóstico del lobby del Congreso (ronda 3) — copia y pega TODA esta salida.');
await probeSenadoApi();
await probeCamaraTable();
console.log('\n══ Fin del diagnóstico ══');
console.log('\nSi la API del Senado pide parámetros (devuelve vacío o error), abre');
console.log('https://www.senado.cl/transparencia/lobby/registros-de-audiencias en el');
console.log('navegador → F12 → Network/Red → filtra "Fetch/XHR" → recarga, y pégame');
console.log('la URL COMPLETA de la llamada a GetReuniones (con todos sus parámetros).');
