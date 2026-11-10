#!/usr/bin/env bash
# Test on a newer minimal distribution with no GTK or WebKit packages installed.
set -euo pipefail
image=$(realpath "$(find release-assets -maxdepth 1 -name '*.AppImage' -print -quit)")
docker build -t verso-appimage-test -f packaging/appimage-test.Dockerfile packaging
# Report the complete executable dependency closure before launching the GUI.
docker run --rm --network none -v "$image:/release/Verso.AppImage:ro" verso-appimage-test sh -c '
  /release/Verso.AppImage --appimage-extract >/dev/null
  export LD_LIBRARY_PATH=/tmp/squashfs-root/usr/lib
  ldd /tmp/squashfs-root/usr/bin/verso
' > artifacts/appimage-minimal-ldd.txt
if grep -q 'not found' artifacts/appimage-minimal-ldd.txt; then
  cat artifacts/appimage-minimal-ldd.txt
  exit 1
fi
trap 'timeout 15s docker rm -f verso-appimage-smoke >/dev/null 2>&1 || true' EXIT
bash scripts/release/gui-smoke.sh appimage-minimal-ubuntu24 docker run --name verso-appimage-smoke --rm --network none --shm-size=256m -e DISPLAY -e LIBGL_ALWAYS_SOFTWARE=1 -e WEBKIT_DISABLE_DMABUF_RENDERER=1 -e WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1 -e APPIMAGE_EXTRACT_AND_RUN=1 -v /tmp/.X11-unix:/tmp/.X11-unix:rw -v "$image:/release/Verso.AppImage:ro" verso-appimage-test /release/Verso.AppImage --appimage-extract-and-run

# A window alone is insufficient: missing fonts can leave every label blank.
tesseract artifacts/appimage-minimal-ubuntu24.png stdout 2>artifacts/appimage-ocr.log > artifacts/appimage-visible-text.txt
grep -qi Verso artifacts/appimage-visible-text.txt
