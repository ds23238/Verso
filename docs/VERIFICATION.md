# Verifikationsstand

## Bestanden

- TypeScript-Produktionsprüfung und Vite-Produktionsbuild.
- 27 Tests in vier Testdateien: Adapter gegen echte native Rust-Bibliotheken,
  Datei-/Offset-/Metadatenregeln, Vorschaugrenzen ohne Datenmutation, neueste
  Revision statt alter Worker-Antworten, Fehler-/Retry-Verhalten.
- React-Komponententests in jsdom: Beispiele, Exportinhalt, Metadaten, Rückwechsel,
  Tastatur-Tabs, Thema ohne Lyrics-Speicherung, Hilfe, Größenlimit vor dem Dateilesen.
- Gebauter Modul-Worker lädt die tatsächlich ausgelieferten WASM-Dateien in einer
  Node-Worker-Testumgebung und verarbeitet alle drei externen Testdateien.
- Tauri-Konfiguration gegen das Schema der installierten CLI validiert.
- Rust-Desktopquellen mit rustfmt geprüft; Cargo.lock für reproduzierbare Auflösung.
- Statische Auslieferung unter `release/verso-web/`, inklusive aller Engine-Dateien.

Die 27 Tests sind keine plattformübergreifende Desktop- oder echte Browserprüfung.
Die Konvertierungsbibliotheken selbst hatten bereits separate Chromium-/Sprach-
Tests; dies ersetzt keine visuelle Prüfung dieser neuen App-Oberfläche.

## Offen / blockiert

- Visuelle Browser-QA: Im verwalteten Sites-Workflow fehlt `cua_repl.js`; dessen
  Vorgaben erlauben hier keinen alternativen Preview-/Browsersteuerungsweg.
  Deshalb wurde kein Preview-Server gestartet und kein Browser-Screenshot als
  Verifikation ausgegeben.
- Linux-Desktopbuild: Systemcheck meldet fehlende WebKitGTK-/GTK-Entwicklungspakete.
  Kein provisionierter Paketinstaller/sudo-Zugang in dieser Umgebung.
- Windows-Desktopbuild und Starttests: keine Windows-Buildumgebung verfügbar.
- Native Dialoge und Worker/WASM unter der tatsächlichen WebView-/CSP-Umgebung
  müssen nach einem erfolgreichen nativen Build geprüft werden.

## Befehle

```sh
npm run build
npm test
node scripts/package-web.mjs
npm run desktop:build
```

Der letzte Befehl stoppt hier absichtlich mit einer verständlichen Meldung,
bevor ein unmöglicher nativer Build angestoßen wird. Voraussetzungen stehen in
`DESKTOP.md`. Alle Inhalte und Tests bleiben lokal; keine Veröffentlichung.
