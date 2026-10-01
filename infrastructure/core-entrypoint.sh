#!/bin/sh
# One image, several hosts. Default (all) serves API + MCP HTTP + ADK
# and starts supercronic for calibration / doctrine checks.
set -eu

VAULT="${OBSIDIAN_VAULT_PATH:-/data/vault}"
mkdir -p "$VAULT" /app/.generated /app/.mstrmnd
if [ ! -f "$VAULT/company.md" ] && [ -f /app/templates/company.md ]; then
  cp /app/templates/company.md /app/templates/operator.md /app/templates/identity.md "$VAULT/" 2>/dev/null || true
fi
if [ ! -d /app/.generated/mstrmnd-md ] && [ -d /app/fixtures/doctrine-min ]; then
  cp -R /app/fixtures/doctrine-min /app/.generated/mstrmnd-md
fi

export OBSIDIAN_VAULT_PATH="$VAULT"
export MSTRMND_CORE="${MSTRMND_CORE:-/app}"
cd /app

MODE="${MSTRMND_HOST_MODE:-all}"
case "$MODE" in
  cron)
    exec supercronic /app/infrastructure/crontab
    ;;
  cli|hermes)
    exec pnpm --filter @mstrmnd/hermes exec tsx src/index.ts "$@"
    ;;
  mcp-stdio)
    exec pnpm --filter @mstrmnd/mcp-server start
    ;;
  calibrate)
    exec pnpm --filter @mstrmnd/host calibrate
    ;;
  tools)
    exec pnpm --filter @mstrmnd/stack-tools check "$@"
    ;;
  api|mcp|all|host)
    if [ "${MSTRMND_CRON:-1}" = "1" ]; then
      supercronic /app/infrastructure/crontab &
    fi
    exec pnpm --filter @mstrmnd/host exec tsx src/index.ts
    ;;
  *)
    echo "unknown MSTRMND_HOST_MODE=$MODE (all|api|mcp|mcp-stdio|cli|calibrate|tools|cron)" >&2
    exit 1
    ;;
esac
