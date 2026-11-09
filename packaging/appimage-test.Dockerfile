FROM ubuntu:24.04
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends libasound2t64 libpulse0 libx11-6 libxext6 libxrender1 libgl1 libegl1 libgbm1 libdrm2 dbus-x11 xdg-utils ca-certificates && rm -rf /var/lib/apt/lists/*
# GTK, WebKit, JavaScriptCore, GStreamer and fonts must come from the AppImage.
WORKDIR /tmp
