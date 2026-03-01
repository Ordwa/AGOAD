#!/usr/bin/env bash
set -euo pipefail

URL="${1:-http://localhost:8080}"
WIDTH="${AGOAD_WINDOW_WIDTH:-390}"
HEIGHT="${AGOAD_WINDOW_HEIGHT:-844}"
POS_X="${AGOAD_WINDOW_X:-80}"
POS_Y="${AGOAD_WINDOW_Y:-40}"
CHROME_APP="${AGOAD_CHROME_APP:-Google Chrome}"

open -na "$CHROME_APP" --args \
  --app="$URL" \
  --new-window \
  --window-size="${WIDTH},${HEIGHT}" \
  --window-position="${POS_X},${POS_Y}" \
  --no-first-run \
  --no-default-browser-check
