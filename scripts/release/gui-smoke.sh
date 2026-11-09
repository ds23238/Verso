#!/usr/bin/env bash
# Run only on an isolated CI X display, never against a user's desktop.
set -euo pipefail
name=$1
shift
mkdir -p artifacts
"$@" >"artifacts/${name}.log" 2>&1 &
app_pid=$!
trap 'kill "$app_pid" 2>/dev/null || true; wait "$app_pid" 2>/dev/null || true' EXIT
found=false
for ((i=0;i<90;i++)); do
  if ! kill -0 "$app_pid" 2>/dev/null; then cat "artifacts/${name}.log"; exit 1; fi
  if xdotool search --onlyvisible --name '^Verso$' >/dev/null 2>&1; then found=true; break; fi
  sleep 1
done
if [[ "$found" != true ]]; then cat "artifacts/${name}.log"; echo 'No visible Verso window'; exit 1; fi
sleep 5
import -window root "artifacts/${name}.png"
kill -0 "$app_pid"
echo "Visible GUI confirmed: $name"
