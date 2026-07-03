#!/bin/bash

set -euo pipefail

echo "================================================"
echo "[SETUP] Setting up environment..."

# Generate a random secret
SECRET=$(openssl rand -base64 32)

# Copy .env.example to .env
cp .env.example .env

# Set BETTER_AUTH_SECRET in .env
sed -i '' "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$SECRET|" .env

echo "================================================"
echo "[SETUP] Installing dependencies..."
bun install

echo "================================================"
echo "[SETUP] Running database migrations..."
bun run db:migrate

echo $'\n================================================'
echo "[SETUP] Project setup complete"
echo "================================================"
