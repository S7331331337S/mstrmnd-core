#!/bin/sh
# Start both halves of the self-hosted stack in one container:
#
#   .output/server/index.mjs  — the eve agent runtime, on loopback
#   server.js                 — the Next.js UI, which proxies /eve/v1/* to it
#
# On Vercel the platform runs these as separate services. Here they are two
# processes, and this script is the whole difference. If one dies, the container
# exits so the orchestrator can replace it rather than serving a half-up app.
set -eu

EVE_PORT="${EVE_PORT:-4274}"
PORT="${PORT:-3000}"

echo "[mstrmnd] starting eve agent runtime on 127.0.0.1:${EVE_PORT}"
HOST=127.0.0.1 NITRO_HOST=127.0.0.1 PORT="${EVE_PORT}" NITRO_PORT="${EVE_PORT}" \
  node .output/server/index.mjs &
eve_pid=$!

# Wait for the runtime to answer before the UI starts proxying to it.
i=0
until wget -qO- "http://127.0.0.1:${EVE_PORT}/eve/v1/health" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "[mstrmnd] eve runtime did not become healthy in 60s" >&2
    kill "$eve_pid" 2>/dev/null || true
    exit 1
  fi
  if ! kill -0 "$eve_pid" 2>/dev/null; then
    echo "[mstrmnd] eve runtime exited during startup" >&2
    exit 1
  fi
  sleep 1
done
echo "[mstrmnd] eve runtime healthy"

echo "[mstrmnd] starting Next.js on 0.0.0.0:${PORT}"
node server.js &
next_pid=$!

# Forward shutdown to both, then exit as soon as either one does. Polled rather
# than `wait -n` so the script works on any POSIX shell, BusyBox included.
trap 'kill "$eve_pid" "$next_pid" 2>/dev/null || true' INT TERM
while kill -0 "$eve_pid" 2>/dev/null && kill -0 "$next_pid" 2>/dev/null; do
  sleep 2
done

echo "[mstrmnd] a server process exited; shutting the container down" >&2
kill "$eve_pid" "$next_pid" 2>/dev/null || true
exit 1
