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

## Verifiziert mit GitHub Actions

[Erfolgreicher Code-Lauf](https://github.com/ds23238/Verso/actions/runs/42525115274),
Quellstand `ff9e27f`.

- Bibliotheken: Rust, Python, Node.js, Dart und Browser-WASM liefern identische
  Ergebnisse für alle drei temporären Eingabedateien. Native Rust-Tests,
  TypeScript-Prüfungen und Dart-Analyse bestanden.
- Web-App: die 27 App-Tests sowie echte Chromium-Tests für Live-Konvertierung,
  Metadaten, ungültige Eingaben, Downloadinhalt, Zwischenablage, Vorschau,
  mobile Tabs, Dateieingabe und Drag-and-drop bestanden.
- Desktop-, Mobile- und Dark-Mode-Screenshots aus Chromium wurden gesichtet.
  Kein horizontaler Seitenüberlauf an den geprüften Größen.
- Linux: portable ausführbare Datei gebaut; tatsächliche WebKit-WebView startet
  und konvertiert über Worker/WASM unter der produktiven CSP.
- Windows: portable EXE gebaut; tatsächliche WebView2 startet und konvertiert
  über Worker/WASM unter der produktiven CSP.
- Artefakte mit Web-App, portablen Dateien, Screenshots und Logs hochgeladen.

Die ursprüngliche lokale Browser-/GTK-/Windows-Beschränkung wurde durch die
passenden GitHub-Runner für diese Prüfungen überwunden. Es wurden keine lokalen
Browserprüfungen entgegen den Vorgaben des verwalteten Sites-Workflows ausgeführt.

## Weitere Grenzen

Native Betriebssystem-Datei-/Speicherdialoge sind nicht automatisiert bedient
worden. Die Starttests ersetzen keine breite Prüfung älterer OS-Versionen oder
manuelle Accessibility-Abnahme. Die Bibliotheks-Sprachanbindungen wurden nicht
alle als native Windows-Pakete getestet; die Windows-App nutzt den getesteten
WASM-Kern.

## Befehle

```sh
npm run build
npm test
node scripts/package-web.mjs
npm run desktop:build
```

Der Desktop-Befehl benötigt die Voraussetzungen aus `DESKTOP.md` und stoppt
hier lokal vor fehlenden Systembibliotheken. Auf GitHub-Runnern ist er erfolgreich
verifiziert. Der Repository-Quellstand und Actions-Artefakte sind veröffentlicht;
ein öffentlich gehosteter App-Dienst oder GitHub Release wurde nicht eingerichtet.
