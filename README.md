# Verso

LRC, Enhanced LRC und Lyricsfile direkt auf dem eigenen Gerät konvertieren.
Autor: GPT 6.1 Sol <gpt_6_1_sol@localhost>.

## Implementiert

- Aufgeräumte React-/TypeScript-Oberfläche ohne App-Icon, Light/Dark/System.
- Live-Eingabe, Dateiimport und Drag-and-drop, Beispiele, Metadaten-Overrides.
- LRC/E-LRC ↔ Lyricsfile über die gemeinsamen Rust-/WASM-Bibliotheken im Worker.
- Aktuelle Ausgabe kopieren und als neue UTF-8-Datei exportieren.
- Konkrete Hinweise zu Informationsverlust, explizite Offset-Entscheidung.
- Timing-Vorschau mit Zeitcursor und vorhandenen Wort-/Zeilenmarken; ohne Audio.
- Responsive Tabs, Keyboard-Bedienung, aktuelle Exporte gegen veraltete Ergebnisse gesperrt.
- Tauri-Hülle mit nativen Dateiöffnen-/Speichern-Dialogen und portablem Buildpfad.

Keine Inhalte werden hochgeladen oder dauerhaft gespeichert. Nur die Theme-
Präferenz wird gespeichert. Ohne Export gehen Inhalte beim Schließen verloren.
Nach dem Laden funktioniert die Konvertierung offline; ein Offline-Neustart
ist ohne separat eingerichteten Service-Worker-/App-Cache nicht zugesichert.

## GitHub-Checkout und Actions

Das Repository ist auf GitHub unter `ds23238/Verso` verfügbar. In einem frischen
Checkout zuerst `python scripts/bootstrap-libraries.py` ausführen, dann `npm ci`.
Die separaten Bibliotheken werden aus versionierten Quellcode-Snapshots neben
Verso bereitgestellt; bestehende lokale Bibliotheks-Repositories werden nie überschrieben.
`vendor/manifest.json` dokumentiert die exakten Quellstände und SHA-256-Prüfsummen.
Kompilierte Bindings und die drei temporären Testdateien bleiben unveröffentlicht.

`.github/workflows/ci.yml` prüft Bibliotheken in allen vier Sprachen, die Web-App
in echtem Chromium und baut portable Linux-/Windows-Dateien. Native WebDriver-
Tests prüfen Start, WASM/Worker unter der tatsächlichen CSP und Live-Konvertierung.
Die Actions-Artefakte enthalten Web-App, portable Dateien und Test-Screenshots.
Ein erfolgreiches Hochladen ist noch keine Aussage über den Ausgang der Läufe;
maßgeblich ist der jeweilige Actions-Status.

## Web-App starten und bauen

Die Repos `Verso`, `lyricsbridge`, `lyricsfile` liegen nebeneinander.
Node >=22.12 bzw. >=20.19, Python >=3.10. Vorhandene WASM-Artefakte werden beim
Start/Build nach `public/engine/` kopiert. Fehlen sie, zunächst die Bibliotheken
bauen (Rust-Target wasm32-unknown-unknown, wasm-bindgen-CLI passend zu Cargo.lock):

```sh
python scripts/bootstrap-libraries.py
npm ci
npm run engine:build
npm run dev
```

Falls die Bibliotheksartefakte bereits vorhanden sind, entfällt `engine:build`.

```sh
npm run package:web
```

`release/verso-web/` und `dist/` enthalten die vollständig statische Web-App
inklusive WASM. Den gesamten Ordner auf einem HTTP(S)-Server hosten, auch unter
einem Unterverzeichnis möglich. Keine Node-/Rust-Serverlaufzeit erforderlich.
Direktes Öffnen von `index.html` über `file://` ist wegen Modul-/Worker-Sicherheit
kein unterstützter Startweg. WASM-Dateien mit `application/wasm` ausliefern.
Bei eigener CSP sind mindestens gleichursprüngliche Skripte/Worker/Verbindungen
und WASM-Ausführung erforderlich; alle Assets werden lokal gebündelt.

## Desktop

Siehe [Desktop-Voraussetzungen und Build](docs/DESKTOP.md).
`npm run desktop:build` erzeugt ohne Installer ausführbare Dateien, sofern die
plattformspezifischen Werkzeuge vorhanden sind. Lokal fehlen hier WebKitGTK-Entwicklungspakete; GitHub Actions übernimmt deshalb
die nativen Builds. Portable Linux- und Windows-Kompilate wurden dort erfolgreich
gebaut und durch echte WebView-Start-/Konvertierungstests geprüft.

## Tests

```sh
npm run build
npm test
```

Tests prüfen den UI-Adapter mit echten nativen Bibliotheken, die gebauten
Worker-/WASM-Artefakte, Komponenten und Hooks in jsdom, stale-result-Schutz,
Dateidekodierung, Metadaten, Exporte, Warnungen, Themes und Tastaturbedienung.
Die drei echten Testdateien bleiben außerhalb aller Repos unter
`../work/test-inputs` oder dem Pfad aus `LYRICS_TEST_INPUTS`.
Für die Adaptertests benötigen die Bibliotheken ihre lokal gebauten Node-Addons.

Die fertige Oberfläche wurde inzwischen in GitHub Actions in echtem Chromium
geprüft; Screenshots für Desktop, Mobile und Dark Mode wurden gesichtet. Native
Start-/Konvertierungstests sind unter Linux-WebKit und Windows-WebView2 bestanden.
Nachweis und Downloads: [verifizierter Actions-Lauf](https://github.com/ds23238/Verso/actions/runs/42525115274).
Siehe auch [Actions und Artefakte](docs/ACTIONS.md).

## CLI

Die bestehende CLI bleibt erhalten:

```sh
node src/cli.mjs import ../work/test-inputs/normal.lrc
node src/cli.mjs export ../work/test-inputs/example.lyricsfile.yaml --enhanced
```

Ausgabe nach stdout, Warnungen nach stderr. Keine Eingabe wird automatisch überschrieben.

## Planung und Design

[App-Plan](docs/APP_PLAN.md), [UI-Blueprint](docs/UI_BLUEPRINT.md),
[Desktop-Entwurf](docs/blueprint/desktop.svg), [Mobil-Entwurf](docs/blueprint/mobile.svg).
Die SVGs dokumentieren den Layoutentwurf; sie wurden auf den Schriftzug „verso“
ohne Logo aktualisiert. Die fertige Oberfläche reduziert weitere Bedienelemente.
Batch-Verarbeitung, Audio-Dateien, Installer und persistente Entwürfe bleiben spätere Erweiterungen.
