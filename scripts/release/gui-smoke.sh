#!/usr/bin/env bash
# Run only on an isolated CI X display, never against a user's desktop.
set -euo pipefail
name=$1
shift
mkdir -p artifacts
"$@" >"artifacts/${name}.log" 2>&1 &
app_pid=$!
cleanup() {
  kill "$app_pid" 2>/dev/null || true
  for ((i=0;i<10;i++)); do
    kill -0 "$app_pid" 2>/dev/null || break
    sleep 0.2
  done
  kill -KILL "$app_pid" 2>/dev/null || true
  wait "$app_pid" 2>/dev/null || true
}
trap cleanup EXIT
found=false
for ((i=0;i<90;i++)); do
  if ! kill -0 "$app_pid" 2>/dev/null; then cat "artifacts/${name}.log"; exit 1; fi
  if xdotool search --onlyvisible --name '^Verso$' >/dev/null 2>&1; then found=true; break; fi
  sleep 1
done
if [[ "$found" != true ]]; then cat "artifacts/${name}.log"; echo 'No visible Verso window'; exit 1; fi
if [[ -n "${VERSO_GUI_EXPECT_TEXT:-}" ]]; then
  rendered=false
  for ((i=0;i<30;i++)); do
    kill -0 "$app_pid"
    import -window root "artifacts/${name}.png"
    tesseract "artifacts/${name}.png" stdout 2>"artifacts/${name}-ocr.log" >"artifacts/${name}-visible-text.txt"
    if grep -qi -- "$VERSO_GUI_EXPECT_TEXT" "artifacts/${name}-visible-text.txt"; then rendered=true; break; fi
    sleep 3
  done
  if [[ "$rendered" != true ]]; then
    xdotool search --onlyvisible --name '^Verso$' getwindowgeometry || true
    cat "artifacts/${name}.log"
    echo 'Application text did not render'
    exit 1
  fi
else
  sleep 5
  import -window root "artifacts/${name}.png"
fi
kill -0 "$app_pid"
echo "Visible GUI confirmed: $name"
