/**
 * Diagnóstico de la fuente de lobby (InfoLobby).
 *
 * El endpoint JSON antiguo (/VirtuosoLobby/Listado/Audiencia/…) devuelve
 * vacío. InfoLobby publica los datos como CSV de datos abiertos en:
 *   /VirtuosoLobby/Visualizacion/{año}/{mes}/dataset-audiencias.csv
 * Este script consulta ese CSV para los últimos meses e imprime el estado,
 * el tamaño y las PRIMERAS LÍNEAS (encabezado con los nombres de columna +
 * filas de muestra). Con eso se puede escribir el parser correcto.
 *
 * Uso:  bun run scripts/debug-lobby.ts
 *
 * Copia y pega TODA la salida.
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

async function probeCsv(year: number, month: number): Promise<void> {
  const url = `${BASE}/VirtuosoLobby/Visualizacion/${year}/${month}/dataset-audiencias.csv?PeriodoVis=1`;
  console.log(`\n── CSV ${year}/${String(month).padStart(2, '0')} ──────────────────────────────`);
  console.log(`URL: ${url}`);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(30000),
    });
    console.log(`HTTP: ${res.status} ${res.statusText}`);
    console.log(`Content-Type: ${res.headers.get('content-type') ?? '(sin header)'}`);
    const text = await res.text();
    console.log(`Tamaño: ${text.length} caracteres`);
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    console.log(`Líneas no vacías: ${lines.length}`);
    if (lines.length > 0) {
      console.log('\nENCABEZADO (nombres de columna):');
      console.log('  ' + lines[0]);
      const samples = lines.slice(1, 4);
      if (samples.length > 0) {
        console.log('\nFILAS DE MUESTRA:');
        samples.forEach((l, i) => console.log(`  [${i + 1}] ${l.slice(0, 300)}`));
      }
    }
  } catch (error) {
    console.log(`✗ Falló: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log('Diagnóstico de InfoLobby (CSV de datos abiertos) — copia y pega TODA esta salida.\n');
// Probamos varios meses hacia atrás: los más recientes pueden no estar publicados aún.
for (const { year, month } of recentMonths(4)) {
  await probeCsv(year, month);
}
console.log('\n── Fin del diagnóstico ──');
