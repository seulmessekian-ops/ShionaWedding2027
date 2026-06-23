#!/usr/bin/env bash
# Sync MAPBOX_TOKEN from .env into assets/config.js (both gitignored).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
CONFIG_FILE="$ROOT/assets/config.js"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing .env — run: cp .env.example .env && paste your token"
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

if [[ -z "${MAPBOX_TOKEN:-}" ]]; then
  echo "MAPBOX_TOKEN is empty in .env"
  exit 1
fi

printf "window.MAPBOX_CONFIG = { token: '%s' };\n" "$MAPBOX_TOKEN" > "$CONFIG_FILE"
echo "Wrote $CONFIG_FILE"
