#!/usr/bin/env bash
# n8n helpers for the docker-compose stack. Usage:
#   scripts/n8n.sh import        import n8n/workflows/*.json and publish the triggers
#   scripts/n8n.sh export        export workflows, clean them and run check-secrets
#   scripts/n8n.sh credentials   create the Mailpit SMTP credential (no secrets involved)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

COMPOSE=(docker compose --env-file n8n/.env)
N8N=("${COMPOSE[@]}" exec -T n8n n8n)

# Workflows that must be published: the webhook and schedule triggers, and (n8n 2.x)
# the error workflow, which is not called unless it is published too.
PUBLISHED_IDS=(LLloanNotify0001 LLoverdueRemind1 LLerrorHandler01)
MAILPIT_CREDENTIAL_ID=LLmailpitSmtp001

require_stack() {
  [ -f n8n/.env ] || { echo "Missing n8n/.env (copy n8n/.env.example)" >&2; exit 1; }
  # Capture first: `cmd | grep -q` under pipefail fails when grep exits early.
  local running
  running="$("${COMPOSE[@]}" ps --services --filter status=running)"
  grep -qx n8n <<<"$running" || {
    echo "n8n is not running. Start it with: pnpm stack:up" >&2
    exit 1
  }
}

case "${1:-}" in
  import)
    require_stack
    "${N8N[@]}" import:workflow --separate --input=/workflows
    for id in "${PUBLISHED_IDS[@]}"; do
      "${N8N[@]}" publish:workflow --id="$id"
    done
    # Published state is loaded at startup; restart so webhooks and schedules register.
    "${COMPOSE[@]}" restart n8n >/dev/null
    echo "Imported and published. n8n is restarting: http://localhost:5678"
    ;;

  export)
    require_stack
    "${N8N[@]}" export:workflow --all --separate --pretty --output=/workflows/.export/
    node scripts/n8n-clean-export.mjs n8n/workflows/.export n8n/workflows
    scripts/check-secrets.sh
    ;;

  credentials)
    require_stack
    # Mailpit accepts unauthenticated SMTP, so this credential holds no secret.
    # It is still written to a git-ignored folder: credential files never get committed.
    mkdir -p n8n/credentials/.local
    cat > n8n/credentials/.local/mailpit-smtp.json <<JSON
[
  {
    "id": "${MAILPIT_CREDENTIAL_ID}",
    "name": "Mailpit SMTP",
    "type": "smtp",
    "data": { "user": "", "password": "", "host": "mailpit", "port": 1025, "secure": false, "disableStartTls": true }
  }
]
JSON
    "${N8N[@]}" import:credentials --input=/credentials/.local/mailpit-smtp.json
    rm -f n8n/credentials/.local/mailpit-smtp.json
    ;;

  *)
    sed -n '2,6p' "$0"
    exit 1
    ;;
esac
