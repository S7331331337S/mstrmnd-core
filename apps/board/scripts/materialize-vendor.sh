#!/usr/bin/env bash
# Fetch the original lockfile and PNG assets from the skills extract commit.
# Those files cannot be pushed through the GitHub MCP text channel; this
# reconstructs them from the pinned source until a git-capable push lands them.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
PIN="${BOARD_VENDOR_PIN:-a74d2c9e0de3d4ebb9774fb27401ffbe619fb1e0}"
BASE="https://raw.githubusercontent.com/S7331331337S/skills/${PIN}/apps/mstrmnd"

mkdir -p "$root/assets"
echo "Fetching Board vendor from skills@${PIN:0:7} …"
curl -fsSL "$BASE/package-lock.json" -o "$root/package-lock.json"
for f in \
  icon.png \
  splash-icon.png \
  favicon.png \
  android-icon-background.png \
  android-icon-foreground.png \
  android-icon-monochrome.png
do
  curl -fsSL "$BASE/assets/$f" -o "$root/assets/$f"
done

test -s "$root/package-lock.json"
test -s "$root/assets/icon.png"
echo "Board vendor materialized ($(wc -c < "$root/package-lock.json") byte lockfile)."
