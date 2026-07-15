#!/bin/bash
#
# Instalador de Radar Legislativo. Deja todo listo para usar:
#   base de datos + configuración + dependencias + migraciones, y al final
#   levanta el portal y lo abre solo en el navegador para que crees tu cuenta.
#
# Uso:  ./scripts/setup.sh        (o: bash scripts/setup.sh)
# Es idempotente: puedes correrlo de nuevo si algo falló a medias.
#
set -euo pipefail

say() { echo; echo "── $1 ─────────────────────────────────"; }

# ── 0. Herramientas necesarias ────────────────────────────────────────────
say "Verificando herramientas"

if ! command -v bun > /dev/null; then
  echo "❌ Falta Bun. Instálalo con:"
  echo "   curl -fsSL https://bun.sh/install | bash"
  echo "   y vuelve a correr este script en una terminal nueva."
  exit 1
fi
echo "✓ Bun $(bun --version)"

HAS_DOCKER=0
if command -v docker > /dev/null && docker info > /dev/null 2>&1; then
  HAS_DOCKER=1
  echo "✓ Docker disponible"
else
  echo "⚠ Docker no está disponible. Si tienes tu propio Postgres, define DATABASE_URL en .env."
  echo "  Si no, instala Docker Desktop (y ábrelo): https://docs.docker.com/get-docker/"
fi

# ── 1. Configuración (.env) ───────────────────────────────────────────────
say "Configuración"

if [ ! -f .env.example ]; then
  echo "❌ No se encontró .env.example. ¿Estás en la carpeta del proyecto?"
  echo "   Corre este script desde la raíz: bash scripts/setup.sh"
  exit 1
fi

gen_secret() {
  if command -v openssl > /dev/null; then
    openssl rand -base64 32
  else
    # Fallback sin openssl (base64 de 32 bytes aleatorios)
    head -c 32 /dev/urandom | base64 | tr -d '\n'
  fi
}

if [ ! -f .env ]; then
  cp .env.example .env
  echo "✓ .env creado"
else
  echo "✓ .env ya existe (se conserva)"
fi

# Completa el secreto de sesión si falta (repara un .env que quedó a medias)
if grep -q '^BETTER_AUTH_SECRET=$' .env; then
  SECRET=$(gen_secret)
  sed -i.bak "s|^BETTER_AUTH_SECRET=$|BETTER_AUTH_SECRET=$SECRET|" .env && rm -f .env.bak
  echo "✓ Secreto de sesión generado automáticamente"
else
  echo "✓ Secreto de sesión ya configurado"
fi

# ── 2. Dependencias ───────────────────────────────────────────────────────
say "Instalando dependencias"
bun install

# ── 3. Base de datos ──────────────────────────────────────────────────────
say "Base de datos"

if [ "$HAS_DOCKER" = "1" ]; then
  if ! docker compose up -d; then
    echo "❌ No se pudo iniciar Postgres con Docker."
    echo "   Causa más común: el puerto 5432 ya está ocupado por otro Postgres."
    echo "   Soluciones:"
    echo "     - Detén el otro Postgres, o"
    echo "     - Define POSTGRES_PORT=5433 en .env y ajusta el puerto en DATABASE_URL."
    echo "   Diagnóstico: docker compose logs db"
    exit 1
  fi
  echo "✓ Postgres iniciado (Docker)"
fi

echo "Esperando a que Postgres esté listo..."
bun run scripts/wait-for-db.ts
echo "✓ Postgres respondiendo"

say "Aplicando migraciones"
bun run db:migrate

# ── 4. Datos de ejemplo (opcional) ────────────────────────────────────────
# Ya NO se crea el usuario por la terminal: la primera cuenta se crea sola en
# el navegador, en la pantalla que se abre al final (/signup). Es más simple
# para gente no técnica.
if [ -t 0 ]; then
  say "Datos de ejemplo"
  read -r -p "¿Cargar proyectos de ley de ejemplo? (temática financiera de muestra; puedes borrarlos) [S/n] " SEED
  if [ "${SEED:-S}" != "n" ] && [ "${SEED:-S}" != "N" ]; then
    bun run scripts/seed-legal-projects.ts
    bun run scripts/seed-proyectos.ts
  fi
fi

# ── 5. Audiencias de lobby (histórico) ────────────────────────────────────
# Carga automática del histórico de audiencias para que la app quede usable
# desde el primer momento. Quedan guardadas en la base de datos (que actúa
# como caché: se ven al instante sin volver a descargar) y el actualizador
# integrado las refresca cada pocas horas. Es NO FATAL: si la descarga falla
# (sin conexión, fuente caída), el setup continúa y el usuario reintenta luego.
# SKIP_LOBBY_SEED=1 lo omite (útil en CI para no bajar ~10 MB en cada build).
if [ "${SKIP_LOBBY_SEED:-0}" != "1" ]; then
  say "Audiencias de lobby (histórico)"
  echo "Descargando audiencias de los últimos 2 años desde InfoLobby…"
  echo "(es una sola vez y puede tardar 1-2 minutos)"
  if bun run scripts/sync-lobby.ts --months 24; then
    echo "✓ Audiencias de lobby cargadas en tu base de datos."
  else
    echo "⚠ No se pudieron cargar las audiencias ahora (¿sin conexión?). No pasa nada:"
    echo "  hazlo después con el botón 'Sincronizar Lobby' de la app, o con:"
    echo "  bun run scripts/sync-lobby.ts --months 24"
  fi
fi

# ── 6. Catálogo de proyectos de ley (buscador) ────────────────────────────
# project_cache es el catálogo de boletines desde el que los usuarios buscan y
# suman proyectos a su lista. La carga histórica (~2024-2026) tarda 10-30 min,
# así que corre EN SEGUNDO PLANO mientras el abogado ya usa la app; --if-empty
# la vuelve idempotente (si ya está cargado, no hace nada). Después, el
# actualizador integrado va sumando los boletines nuevos solo.
# SKIP_CACHE_SEED=1 lo omite (útil en CI).
if [ "${SKIP_CACHE_SEED:-0}" != "1" ]; then
  say "Catálogo de proyectos de ley (buscador)"
  echo "Cargando el catálogo de boletines EN SEGUNDO PLANO (10-30 min la primera vez)."
  echo "Puedes usar la app mientras tanto: el buscador se va llenando solo."
  echo "Avance en: .radar-catalogo.log"
  nohup bun run scripts/bulk-sync.ts --if-empty > .radar-catalogo.log 2>&1 &
fi

# ── Listo ─────────────────────────────────────────────────────────────────
say "Listo 🎉"
echo "El portal se abrirá solo en tu navegador. La primera vez verás una"
echo "pantalla para CREAR TU CUENTA (nombre, email y contraseña) — llénala y"
echo "entras directo. No necesitas hacer nada más en la terminal."
echo

if [ -t 1 ]; then
  # Terminal interactiva: levanta la app y abre el navegador en el landing.
  # open-when-ready espera a que el servidor responda y abre localhost:3000;
  # exec deja `next dev` en primer plano para que Ctrl+C lo detenga.
  echo "(Para apagar la app: presiona Ctrl+C en esta ventana.)"
  # Abrimos directo en /signup: en una instalación nueva muestra el formulario
  # para crear tu cuenta; si ya existe una, ofrece ir a iniciar sesión.
  APP_URL="http://localhost:3000/signup" bun run scripts/open-when-ready.ts &
  exec bun run dev
else
  # Sin terminal interactiva (CI, scripts): no lanzar un servidor que colgaría.
  echo "Levanta el portal con:  bun run dev"
  echo "Y ábrelo en:            http://localhost:3000"
fi
