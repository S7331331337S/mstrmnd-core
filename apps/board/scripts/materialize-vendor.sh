#!/usr/bin/env bash
# Reconstruct package-lock.json and PNG assets uploaded as split base64
# (GitHub MCP cannot push raw binaries or the 300KB lockfile intact).
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
cat .vendor/bundle.tgz.b64.part* | base64 -d | tar xz -C "$root"
test -f package-lock.json
test -f assets/icon.png
echo "Board vendor materialized ($(wc -c < package-lock.json) byte lockfile)."
