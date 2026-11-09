#!/usr/bin/env bash
set -euo pipefail
version=$(python3 -c 'import json; print(json.load(open("package.json"))["version"])')
mkdir -p artifacts release-assets packaging/flatpak/binary
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak install --user --noninteractive -y flathub org.gnome.Platform//49 org.gnome.Sdk//49
flatpak remote-info --user --show-metadata flathub org.gnome.Platform//49 > artifacts/flatpak-runtime-metadata.txt
deb=$(find release-assets -maxdepth 1 -name '*.deb' -print -quit)
dpkg-deb -x "$deb" "$RUNNER_TEMP/verso-deb"
install -m755 "$RUNNER_TEMP/verso-deb/usr/bin/verso" packaging/flatpak/binary/verso
cp packaging/flatpak/local.verso.app.desktop packaging/flatpak/binary/
cp src-tauri/icons/icon.png packaging/flatpak/binary/
flatpak-builder --user --force-clean --repo=flatpak-repo --install flatpak-build packaging/flatpak/local.verso.app.yml
flatpak build-bundle --runtime-repo=https://dl.flathub.org/repo/flathub.flatpakrepo flatpak-repo "release-assets/verso-${version}-x86_64.flatpak" local.verso.app
flatpak run --command=sh local.verso.app -c 'ldd /app/bin/verso' > artifacts/flatpak-ldd.txt
if grep -q 'not found' artifacts/flatpak-ldd.txt; then cat artifacts/flatpak-ldd.txt; exit 1; fi
flatpak run --command=sh local.verso.app -c 'find /usr/lib -name "libwebkit2gtk-4.1.so*" -o -name "libgstflac.so" -o -name "libgstmpg123.so" -o -name "libgstlibav.so" -o -name "libgstfaad.so" -o -name "libgstfdkaac.so"' > artifacts/flatpak-media-libraries.txt
grep -q libwebkit2gtk artifacts/flatpak-media-libraries.txt
grep -q libgstflac artifacts/flatpak-media-libraries.txt
grep -Eq 'libgst(mpg123|libav)' artifacts/flatpak-media-libraries.txt
grep -Eq 'libgst(libav|faad|fdkaac)' artifacts/flatpak-media-libraries.txt
dbus-run-session -- xvfb-run -a bash scripts/release/gui-smoke.sh flatpak-start flatpak run --env=LIBGL_ALWAYS_SOFTWARE=1 --env=WEBKIT_DISABLE_DMABUF_RENDERER=1 local.verso.app
