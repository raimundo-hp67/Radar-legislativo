#!/bin/bash
#
# Instalador de Radar Legislativo. Deja todo listo para usar:
#   base de datos + configuración + dependencias + migraciones + tu usuario.
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

# ── 4. Primer usuario ─────────────────────────────────────────────────────
# USER_CREATED controla el recordatorio final: sin cuenta, la app SOLO
# muestra una pantalla de login sin ninguna pista de qué hacer, así que este
# aviso tiene que ser lo ÚLTIMO que se imprime — imposible de perder en el
# scroll de bun install / migraciones / seeds.
USER_CREATED=0

if [ -t 0 ]; then
  say "Tu usuario"
  echo "El portal requiere iniciar sesión. Creemos tu cuenta (deja el email vacío para saltar este paso):"
  ATTEMPT=0
  while [ "$ATTEMPT" -lt 3 ]; do
    read -r -p "  Email: " ADMIN_EMAIL
    if [ -z "$ADMIN_EMAIL" ]; then
      echo "  Saltado (puedes crearlo después; te lo recuerdo al final)."
      break
    fi
    read -r -s -p "  Contraseña (mínimo 8 caracteres): " ADMIN_PASS
    echo
    read -r -p "  Nombre: " ADMIN_NAME
    if bun run scripts/create-user.ts "$ADMIN_EMAIL" "$ADMIN_PASS" "${ADMIN_NAME:-$ADMIN_EMAIL}"; then
      USER_CREATED=1
      break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    if [ "$ATTEMPT" -lt 3 ]; then
      echo "  ⚠ No se pudo crear el usuario. Intentemos de nuevo (email vacío para saltar):"
    else
      echo "  ⚠ No se pudo crear el usuario tras 3 intentos (te lo recuerdo al final)."
    fi
  done

  # ── 5. Datos de ejemplo ─────────────────────────────────────────────────
  say "Datos de ejemplo"
  read -r -p "¿Cargar proyectos de ley de ejemplo? (temática financiera de muestra; puedes borrarlos) [S/n] " SEED
  if [ "${SEED:-S}" != "n" ] && [ "${SEED:-S}" != "N" ]; then
    bun run scripts/seed-legal-projects.ts
    bun run scripts/seed-proyectos.ts
  fi
else
  echo
  echo "⚠ Terminal no interactiva: usuario y datos de ejemplo saltados (te lo recuerdo al final)."
fi

# ── Listo ─────────────────────────────────────────────────────────────────
say "Listo 🎉"
if [ "$USER_CREATED" = "0" ]; then
  echo "⚠️  IMPORTANTE — todavía NO tienes una cuenta. Sin esto, la app solo te"
  echo "    mostrará una pantalla de login vacía y no podrás entrar. Créala con:"
  echo
  echo "    bun run scripts/create-user.ts tu@email.com 'una-clave-segura' 'Tu Nombre'"
  echo
fi
echo "Inicia el portal con:   bun run dev"
echo "Y ábrelo en:            http://localhost:3000"
