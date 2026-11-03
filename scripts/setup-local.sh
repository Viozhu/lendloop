#!/usr/bin/env bash
# One-time local wiring between Convex and n8n:
#   - creates n8n/.env from the example with fresh random secrets (if missing)
#   - copies the shared secrets and URLs into the Convex deployment env
#   - optionally sets the Clerk issuer: scripts/setup-local.sh https://xxx.clerk.accounts.dev
#
# Run after `npx convex dev` has created the deployment. Safe to re-run: an
# existing n8n/.env is kept and the Convex values are overwritten with it.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

if [ ! -f n8n/.env ]; then
  sed -e "s/^N8N_ENCRYPTION_KEY=$/N8N_ENCRYPTION_KEY=$(openssl rand -hex 32)/" \
      -e "s/^CONVEX_TO_N8N_SECRET=$/CONVEX_TO_N8N_SECRET=$(openssl rand -hex 32)/" \
      -e "s/^N8N_TO_CONVEX_SECRET=$/N8N_TO_CONVEX_SECRET=$(openssl rand -hex 32)/" \
      -e "s/^POSTGRES_PASSWORD=$/POSTGRES_PASSWORD=$(openssl rand -hex 16)/" \
      n8n/.env.example > n8n/.env
  chmod 600 n8n/.env
  echo "Created n8n/.env with random secrets"
fi

value() { grep -E "^$1=" n8n/.env | head -1 | cut -d= -f2-; }

set_convex() {
  # Values go through argv to the local CLI only; nothing is echoed.
  npx convex env set "$1" "$2" >/dev/null
  echo "Convex env: $1 set"
}

set_convex CONVEX_TO_N8N_SECRET "$(value CONVEX_TO_N8N_SECRET)"
set_convex N8N_TO_CONVEX_SECRET "$(value N8N_TO_CONVEX_SECRET)"
set_convex N8N_NOTIFY_WEBHOOK_URL "${N8N_NOTIFY_WEBHOOK_URL:-http://localhost:5678/webhook/lendloop-loan-events}"
set_convex APP_BASE_URL "$(value APP_BASE_URL)"

if [ -n "${1:-}" ]; then
  set_convex CLERK_JWT_ISSUER_DOMAIN "$1"
fi
