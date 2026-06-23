#!/usr/bin/env bash
# Write assets/config.js from MAPBOX_TOKEN (.env locally, env var on Vercel).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
CONFIG_FILE="$ROOT/assets/config.js"

if [[ -z "${MAPBOX_TOKEN:-}" && -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

if [[ -z "${MAPBOX_TOKEN:-}" ]]; then
  echo "Set MAPBOX_TOKEN in .env (local) or Vercel → Project → Settings → Environment Variables"
  exit 1
fi

printf "window.MAPBOX_CONFIG = { token: '%s' };\n" "$MAPBOX_TOKEN" > "$CONFIG_FILE"
echo "Wrote $CONFIG_FILE"
