# Native Desktop-App

Die Tauri-2-Hülle ist implementiert. Sie verwendet dieselben lokal gebündelten
WASM-Bibliotheken wie die Website. Dateiöffnen und Speichern laufen über native
Dialoge; es gibt keine frei zugängliche Dateisystem-API im Frontend.
Kein eigenes App-Icon, kein Installer und keine automatisch gestarteten Server.
Tauri verlangt intern PNG-/ICO-Ressourcen; dafür liegen ausschließlich transparente
technische Platzhalter vor, kein Logo.

## Voraussetzungen und Build

Alle drei Repositories nebeneinander ablegen. Node >=22.12 (oder >=20.19 gemäß
Vite 7), Python >=3.10, Rust stable und die passende wasm-bindgen-CLI installieren.

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.130 --locked
npm ci
npm run engine:build
npm run desktop:build
```

`npm run engine:build` baut die WASM-Artefakte der beiden Nachbar-Repositories.
Die Desktop-CLI baut vorher automatisch das Frontend. Fertige ausführbare Dateien
werden mit einem Laufzeithinweis unter `release/verso-<plattform>-<arch>/` abgelegt.
Entwicklungsmodus: `npm run desktop:dev`.

### Linux

Auf Debian/Ubuntu werden insbesondere diese Entwicklungspakete benötigt:

```sh
sudo apt-get install build-essential pkg-config libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev patchelf
```

Der Build erzeugt eine ELF-Datei, keinen Installer. Der Zielrechner benötigt
WebKitGTK-4.1-/GTK-3-Laufzeitbibliotheken. Ein vollständig selbsttragendes AppImage
ist in diesem Schritt nicht versprochen. Builds sollten auf einer Distribution
mit für die Zielsysteme geeigneter glibc-Version erzeugt werden.

### Windows

Auf Windows mit Rust-MSVC-Toolchain, Visual Studio Build Tools inklusive C++-
Desktopentwicklung und Windows SDK bauen. WebView2 Runtime ist zur Ausführung
notwendig. Der Build erzeugt eine portable `.exe`; kein MSI/NSIS-Installer.
Der Linux-Buildprozess ersetzt keine Prüfung auf Windows.

## Rechte und Speicher

Nur das lokale Hauptfenster erhält Core-IPC. Die beiden eigenen Rust-Kommandos
öffnen einen nativen Dateidialog. Lesen akzeptiert ausschließlich die ausdrücklich
gewählte Datei, UTF-8 und höchstens 2 MiB. Speichern verwendet den ausdrücklich
gewählten Zielpfad. Es werden keine Dateiinhalte in Einstellungen gespeichert.
Die Theme-Präferenz wird lokal gespeichert; WebView2/Tauri können übliche
Anwendungs-/WebView-Datenverzeichnisse anlegen.

## Verifikationsstand in dieser Umgebung

Die Konfiguration wurde gegen das Schema der installierten Tauri-CLI geprüft;
die Rust-Quellen wurden formatiert. Ein nativer Build wurde versucht, stoppt aber
bereits beim Systemcheck: WebKitGTK-/GTK-Entwicklungspakete sind nicht vorhanden.
Es gibt hier keine provisionierte sudo-/Paketinstaller-Möglichkeit. Ein Windows-
Buildsystem steht ebenfalls nicht zur Verfügung.

Deshalb sind derzeit **keine erfolgreich gebauten oder gestarteten nativen
Linux-/Windows-Kompilate** bestätigt. Vor einer Desktop-Freigabe müssen auf beiden
Systemen Build, Start, WASM-/Worker-Laden unter der Tauri-CSP sowie native Datei-
dialoge, Unicode und Export geprüft werden. Die Web-App ist separat gebaut und
mit den dokumentierten Komponenten-/Worker-Tests geprüft.
