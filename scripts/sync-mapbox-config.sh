#!/usr/bin/env bash
# Write assets/config.js from MAPBOX_TOKEN (.env locally; Vercel uses api/mapbox-config.js).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
CONFIG_FILE="$ROOT/assets/config.js"

if [[ -z "${MAPBOX_TOKEN:-}" && -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

if [[ -z "${MAPBOX_TOKEN:-}" ]]; then
  printf "window.MAPBOX_CONFIG = { token: '' };\n" > "$CONFIG_FILE"
  echo "WARNING: MAPBOX_TOKEN unset — wrote empty $CONFIG_FILE (map will show fallback)"
  exit 0
fi

printf "window.MAPBOX_CONFIG = { token: '%s' };\n" "$MAPBOX_TOKEN" > "$CONFIG_FILE"
echo "Wrote $CONFIG_FILE"
