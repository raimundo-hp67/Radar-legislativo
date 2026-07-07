/**
 * Diagnóstico de la fuente de lobby (InfoLobby / VirtuosoLobby).
 *
 * Sirve para entender por qué "Sincronizar Lobby" devuelve 0: consulta el
 * endpoint para los últimos meses e imprime EXACTAMENTE qué responde —
 * código HTTP, tipo de contenido, cuántos registros llegan y los NOMBRES
 * de los campos del primer registro. Con eso se puede arreglar el parser
 * si la fuente cambió su formato.
 *
 * Uso:  bun run scripts/debug-lobby.ts
 *
 * Copia y pega TODA la salida para diagnosticar el problema.
 */
export {};

const BASE = 'https://www.infolobby.cl';

function recentMonths(n: number): Array<{ year: number, month: number }> {
  const out: Array<{ year: number, month: number }> = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return out;
}

async function probe(year: number, month: number): Promise<void> {
  const url = `${BASE}/VirtuosoLobby/Listado/Audiencia/1/${year}/${month}/0`;
  console.log(`\n── ${year}/${String(month).padStart(2, '0')} ──────────────────────────────`);
  console.log(`URL: ${url}`);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(20000),
    });
    console.log(`HTTP: ${res.status} ${res.statusText}`);
    console.log(`Content-Type: ${res.headers.get('content-type') ?? '(sin header)'}`);

    const text = await res.text();
    console.log(`Tamaño del cuerpo: ${text.length} caracteres`);

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      console.log('⚠ El cuerpo NO es JSON. Primeros 400 caracteres:');
      console.log(text.slice(0, 400));
      return;
    }

    if (Array.isArray(json)) {
      console.log(`✓ Es un array JSON con ${json.length} registros.`);
      if (json.length > 0) {
        console.log('Campos del primer registro (NOMBRES exactos):');
        console.log('  ', Object.keys(json[0] as object).join(', '));
        console.log('Primer registro completo:');
        console.log(JSON.stringify(json[0], null, 2));
      }
    } else {
      console.log('⚠ La respuesta es JSON pero NO es un array. Estructura:');
      console.log(JSON.stringify(json, null, 2).slice(0, 800));
    }
  } catch (error) {
    console.log(`✗ Falló la conexión: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log('Diagnóstico de InfoLobby — copia y pega TODA esta salida.\n');
for (const { year, month } of recentMonths(3)) {
  await probe(year, month);
}
console.log('\n── Fin del diagnóstico ──');
