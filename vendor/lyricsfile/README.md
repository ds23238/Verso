# lyricsfile

Autor: GPT 6.1 Sol <gpt_6_1_sol@localhost>

Lokaler Entwicklungsstand 0.1.0. Rust ist die einzige Implementierung der
Formatlogik. Python (ctypes), Node.js (N-API/napi-rs), Dart (dart:ffi)
sowie Browser/TypeScript (WebAssembly) verwenden denselben Kern. Es sind noch
keine Registry-Pakete veröffentlicht.

## Aufgabe

Lyricsfile 1.0 Draft lesen, validieren und schreiben, auch ohne Konvertierung.
Typisiertes Rust-Modell für Metadaten, Zeilen, Wörter und unbekannte Erweiterungen.
Unbekannte Felder bleiben erhalten; YAML-Kommentare und die ursprüngliche
Formatierung werden beim Neuschreiben nicht erhalten.

API: Rust `from_yaml`, `to_yaml`, `validate`; Python/Node `parse`, `stringify`,
`validate`; Dart `LyricsFile.parse`, `.stringify`, `.validate`.
`parse` liefert `{document, warnings}`, `stringify` einen YAML-String und
`validate` eine Liste von Diagnosen mit `severity`, `path`, `message`.
Strukturelle Fehler werfen einen Fehler. Semantische Warnungen blockieren das
Schreiben nicht; ungültige Zeiten und Versionen schon.

## Lokal bauen

Voraussetzungen: Rust/Cargo, C-Linker und Python 3.10+. Für Node-Tests Node >=18,
für Dart-Tests Dart >=3.4. Noch keine fertigen Distributionspakete/Wheels.

```sh
python scripts/build.py
```

Erzeugt ignorierte native Bibliotheken und einen separaten Node-Addon unter
`build/`. Beide Varianten werden getrennt gebaut, damit die C-ABI keine
Node-Laufzeit benötigt. Plattformabhängig `.so`, `.dylib` oder `.dll`.
Für Node entsteht `lyricsfile.node`. Gebaute Dateien werden nicht committet.

Python: `bindings/python` in `PYTHONPATH` aufnehmen oder das Package lokal
installieren. Nach Installation `LYRICSFILE_LIBRARY` auf die native Bibliothek
setzen; im Quellbaum wird `build/` automatisch gefunden.
Node: `bindings/node/index.js` importieren oder per lokaler `file:`-Abhängigkeit
verwenden. Optional `LYRICSFILE_NODE_LIBRARY` setzen.
Dart: `bindings/dart` als Pfadabhängigkeit verwenden, `dart pub get` ausführen
und `LYRICSFILE_LIBRARY` setzen oder `libraryPath` übergeben.

Die Dart-Anbindung funktioniert nativ für Dart/Flutter. Die Bibliothek muss für
jede Zielplattform gebaut und mit der Anwendung gebündelt werden. Android/iOS,
Windows/macOS sowie Flutter-Integration sind hier noch nicht getestet;
Flutter Web und automatische Flutter-Native-Asset-Paketierung folgen separat.
Node prüft sichere JavaScript-Ganzzahlen, Rust-Zeitfelder verwenden i64.

## Tests

Die drei Eingabedateien liegen absichtlich außerhalb aller Repositories.
`LYRICS_TEST_INPUTS` zeigt auf ihren Ordner mit `normal.lrc`, `enhanced.lrc`,
`example.lyricsfile.yaml`. Standard der Rust-Tests: `../work/test-inputs`.
Testcode liegt im Repo, die Testdateien und erzeugten Vergleichsergebnisse nicht.

```sh
cargo test --locked
PYTHONPATH=bindings/python python tests/smoke.py
node tests/smoke.mjs
cd bindings/dart && dart run test/smoke.dart
```

Für die vier nativen Sprachen gemeinsam: im benachbarten `lyricsbridge`-Repo
`python scripts/check.py --build`. Mit `--web` kommen WASM, TypeScript und
Chromium hinzu. Die Werkzeuge müssen im PATH liegen.
Getesteter Build in dieser Sitzung: Linux x86_64; keine Aussage über fertige
Windows-/Mobile-Builds oder öffentliche Package-Verfügbarkeit.

## TypeScript und Browser/WASM

Node.js und Browser verwenden dasselbe npm-Package unter `bindings/node`.
Der Hauptimport `lyricsfile` nutzt unter Node das native Addon. Browser-Bundler
mit der Bedingung `browser` wählen die WASM-Anbindung. Der explizite Import
`lyricsfile/web` wählt immer WASM und ist für Browsercode empfohlen.

```typescript
import { init, parse, stringify, type Document } from 'lyricsfile/web';

await init();
const document: Document = parse(yamlText).document;
const yaml: string = stringify(document);
```

Nach dem einmaligen asynchronen Laden sind die API-Aufrufe synchron. Alle
Konvertierungen laufen lokal. Ein Web Worker kann dieselbe Web-API verwenden.
Vor `await init()` melden API-Aufrufe einen verständlichen Fehler. Gleichzeitige
Initialisierungen teilen denselben Ladevorgang; nach einem Ladefehler ist ein
neuer Versuch möglich. Wiederholtes `init()` nach Erfolg ist wirkungslos.

Standardmäßig lädt `init()` die WASM-Datei neben dem generierten Loader.
Optional sind URL, Request, Response, BufferSource oder WebAssembly.Module erlaubt,
z. B. `await init(new URL('/assets/lyricsfile_bg.wasm', location.href))`.
In Bundler-/Hosting-Konfigurationen müssen die erzeugten WASM-Assets erreichbar
bleiben; für Streaming sollte der Server `application/wasm` liefern.

Die vollständigen Typen für Dokumente, Metadaten, Zeilen und Wörter stammen aus
`lyricsfile`; `lyricsbridge` verwendet und reexportiert diese Typen. Deshalb
benötigt dessen npm-Package `lyricsfile` als Peer-Abhängigkeit. Im lokalen
Entwicklungsbaum richtet `npm ci` diese über eine Pfadabhängigkeit ein.

### Browser-Binding bauen

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.130 --locked
python scripts/build_web.py
```

Die CLI-Version muss zum Eintrag `wasm-bindgen` in `Cargo.lock` passen;
das Build-Skript prüft dies. Generierte Loader und WASM-Dateien liegen unter
`bindings/node/web/wasm/` und bleiben in Git ignoriert. Ein npm-Paket enthält sie
nach dem Build über die explizite `files`-Liste; ein Pack-Test prüft diese Assets.
Native und Browser-Build sind getrennte Schritte. WASM benötigt keinen C-Linker.

### TypeScript prüfen

```sh
cd bindings/node
npm ci --ignore-scripts
npm run test:types
```

Prüft striktes TypeScript für Node ohne DOM-Typen sowie für Browser mit
Bundler-Auflösung. Die Node-TypeScript-Beispiele werden auch ausgeführt.
Erwartete Typfehler stellen sicher, dass z. B. Zeiten keine Strings sein dürfen.
Der Browser-Test liegt im `lyricsbridge`-Package und prüft beide Bibliotheken
zusammen mit den drei externen Testdateien und der direkten Rust-Referenz.

## Formatgrundlage

[Draft-Spezifikation](https://github.com/tranxuanthang/lyricsfile/blob/main/SPECIFICATION.md),
Quellstand: Blob `ec6818ab344583ae9b41e4e5d6169b87981669ac`.
Lyricsfile ist noch ein Entwurf. YAML wird mit `serde_yaml_ng` gelesen;
mehrere Dokumente, doppelte Schlüssel, benutzerdefinierte Tags, Fließkommazahlen,
Nicht-String-Schlüssel sowie zu große/zu tiefe Eingaben werden abgelehnt.
