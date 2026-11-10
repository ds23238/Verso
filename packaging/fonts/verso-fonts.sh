#!/bin/sh
# Resolve bundled fonts after mounting or relocating the AppDir.
export FONTCONFIG_FILE="$APPDIR/usr/etc/fonts/fonts.conf"
export FONTCONFIG_PATH="$APPDIR/usr/etc/fonts"
