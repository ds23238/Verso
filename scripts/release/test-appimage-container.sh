#!/usr/bin/env bash
# Test on a newer minimal distribution with no GTK or WebKit packages installed.
set -euo pipefail
image=$(realpath "$(find release-assets -maxdepth 1 -name '*.AppImage' -print -quit)")
docker build -t verso-appimage-test -f packaging/appimage-test.Dockerfile packaging
bash scripts/release/gui-smoke.sh appimage-minimal-ubuntu24 docker run --rm --network none --shm-size=256m -e DISPLAY -e LIBGL_ALWAYS_SOFTWARE=1 -e WEBKIT_DISABLE_DMABUF_RENDERER=1 -e WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1 -e APPIMAGE_EXTRACT_AND_RUN=1 -v /tmp/.X11-unix:/tmp/.X11-unix:rw -v "$image:/release/Verso.AppImage:ro" verso-appimage-test /release/Verso.AppImage --appimage-extract-and-run
