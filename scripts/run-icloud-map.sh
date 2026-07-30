#!/bin/bash
# Wrapper: run the iCloud->vault map generator.
# Logs every step so failures are never silent under launchd.
LOG="$HOME/Library/Logs/icloud-vault-map.log"
PY="$(command -v python3)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$SCRIPT_DIR/sync-vault-map.py"
ICLOUD="$HOME/Library/Mobile Documents/com~apple~CloudDocs"

echo "[$(date)] starting HOME=$HOME" >> "$LOG"

if [ -z "$PY" ]; then
  echo "[$(date)] ABORT: python3 not found in PATH" >> "$LOG"
  exit 1
fi
if [ ! -f "$SCRIPT" ]; then
  echo "[$(date)] ABORT: script missing $SCRIPT" >> "$LOG"
  exit 1
fi

ready=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  if [ -d "$ICLOUD" ] && [ -n "$(ls -A "$ICLOUD" 2>/dev/null)" ]; then
    ready=1
    break
  fi
  sleep 2
done
if [ "$ready" -ne 1 ]; then
  echo "[$(date)] ABORT: iCloud Drive not mounted (HOME=$HOME)" >> "$LOG"
  exit 1
fi
echo "[$(date)] gate passed, running generator" >> "$LOG"

"$PY" "$SCRIPT" >> "$LOG" 2>&1
echo "[$(date)] exit=$? notes written" >> "$LOG"
