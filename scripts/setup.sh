#!/bin/bash
#
# Instalador de Radar Legislativo. Deja todo listo para usar:
#   base de datos + configuración + dependencias + migraciones + tu usuario.
#
# Uso:  ./scripts/setup.sh
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
  echo "  Si no, instala Docker Desktop: https://docs.docker.com/get-docker/"
fi

# ── 1. Configuración (.env) ───────────────────────────────────────────────
say "Configuración"

if [ -f .env ]; then
  echo "✓ .env ya existe (no se toca)"
else
  cp .env.example .env
  SECRET=$(openssl rand -base64 32)
  sed -i.bak "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$SECRET|" .env && rm -f .env.bak
  echo "✓ .env creado con secreto de sesión generado automáticamente"
fi

# ── 2. Dependencias ───────────────────────────────────────────────────────
say "Instalando dependencias"
bun install

# ── 3. Base de datos ──────────────────────────────────────────────────────
say "Base de datos"

if [ "$HAS_DOCKER" = "1" ]; then
  docker compose up -d
  echo "✓ Postgres iniciado (Docker)"
fi

echo "Esperando a que Postgres esté listo..."
bun run scripts/wait-for-db.ts
echo "✓ Postgres respondiendo"

say "Aplicando migraciones"
bun run db:migrate

# ── 4. Primer usuario ─────────────────────────────────────────────────────
if [ -t 0 ]; then
  say "Tu usuario"
  echo "El portal requiere iniciar sesión. Creemos tu cuenta (deja el email vacío para saltar este paso):"
  read -r -p "  Email: " ADMIN_EMAIL
  if [ -n "$ADMIN_EMAIL" ]; then
    read -r -s -p "  Contraseña (mínimo 8 caracteres): " ADMIN_PASS
    echo
    read -r -p "  Nombre: " ADMIN_NAME
    bun run scripts/create-user.ts "$ADMIN_EMAIL" "$ADMIN_PASS" "${ADMIN_NAME:-$ADMIN_EMAIL}"
  else
    echo "  Saltado. Puedes crearlo después con:"
    echo "  bun run scripts/create-user.ts tu@email.com 'una-clave-segura' 'Tu Nombre'"
  fi

  # ── 5. Datos de ejemplo ─────────────────────────────────────────────────
  say "Datos de ejemplo"
  read -r -p "¿Cargar proyectos de ley de ejemplo (regulación financiera chilena)? [S/n] " SEED
  if [ "${SEED:-S}" != "n" ] && [ "${SEED:-S}" != "N" ]; then
    bun run scripts/seed-legal-projects.ts
    bun run scripts/seed-proyectos.ts
  fi
else
  echo
  echo "(Modo no interactivo: usuario y datos de ejemplo saltados.)"
  echo "Crea tu usuario con: bun run scripts/create-user.ts tu@email.com 'una-clave-segura'"
fi

# ── Listo ─────────────────────────────────────────────────────────────────
say "Listo 🎉"
echo "Inicia el portal con:   bun run dev"
echo "Y ábrelo en:            http://localhost:3000"
