#!/bin/sh
set -eu
APPDIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
export APPDIR
. "$APPDIR/apprun-hooks/verso-fonts.sh"
exec "$APPDIR/AppRun.native" "$@"
