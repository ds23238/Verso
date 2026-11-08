# lyricsbridge

Autor: GPT 6.1 Sol <gpt_6_1_sol@localhost>

Lokaler Entwicklungsstand 0.1.0. Rust ist die einzige Implementierung der
Formatlogik. Python (ctypes), Node.js (N-API/napi-rs), Dart (dart:ffi)
sowie Browser/TypeScript (WebAssembly) verwenden denselben Kern. Es sind noch
keine Registry-Pakete veröffentlicht.

## Aufgabe

LRC und Enhanced LRC nach Lyricsfile und zurück konvertieren. Abhängigkeit:
`../lyricsfile` (lokaler Cargo-Pfad). Die beiden Repos nebeneinander ablegen.

API: Rust `from_lrc`, `to_lrc`; Python `from_lrc`, `to_lrc`;
Node `fromLrc`, `toLrc`; Dart `LyricsBridge.fromLrc`, `.toLrc`.
Import liefert `{document, yaml, warnings}`. Export liefert `{output, warnings}`.
Rust gibt beim Import das typisierte Dokument in `Conversion.output` zurück.

Python-Beispiel:

```python
import lyricsbridge
result = lyricsbridge.from_lrc(text, title="Titel", artist="Interpret")
print(result["yaml"])
reverse = lyricsbridge.to_lrc(result["document"], enhanced=True)
```

### Konvertierungsregeln

- Zeitauflösung: ganzzahlige Millisekunden; 1–3 Nachkommastellen beim LRC-Import.
- Mehrere Zeilen-Zeitstempel werden expandiert, anschließend stabil sortiert.
- Keine Wort- oder Endzeiten werden erfunden.
- E-LRC: eine Zeilenzeit und absolute `<mm:ss.fff>`-Wort-/Segmentanfänge.
  Leerzeichen und auch leere Abschlusssegmente bleiben erhalten. Text vor dem
  ersten Wortmarker und mehrfache Zeilenzeiten mit Wortmarkern sind mehrdeutig
  und werden abgelehnt. Andere Karaoke-Dialekte sind noch nicht unterstützt.
- Import `offset`: standardmäßig `reject`; `apply` addiert den LRC-Offset auf
  alle vorhandenen Zeilen- und Wortanfänge, `ignore` verwirft ihn mit Warnung.
  Negative Ergebnisse sind Fehler. Lyricsfile `offset_ms` bleibt unberührt;
  ein nicht-null Offset verhindert den LRC-Export bis zur bewussten Auflösung.
- `plain` wird beim Import aus dem Text in Eingabereihenfolge abgeleitet;
  wiederholte Zeilenzeiten duplizieren dabei nicht den Plain-Text.
- Unbekannte LRC-Tags bleiben in `x-lrc-tags` erhalten.
- Normaler LRC-Export entfernt Wortzeiten mit Warnung; `enhanced=true` erhält
  vorhandene Wortanfänge. Explizite Endzeiten, Sprache, Erweiterungen und eine
  abweichende separate Plain-Version werden gegebenenfalls mit Warnung ausgelassen.
- Ohne synchronisierte Zeilen wird nur unsynchronisierter Text exportiert,
  ohne künstliche Zeitstempel. Instrumentalstatus ist nicht in LRC darstellbar.

## Lokal bauen

Voraussetzungen: Rust/Cargo, C-Linker und Python 3.10+. Für Node-Tests Node >=18,
für Dart-Tests Dart >=3.4. Noch keine fertigen Distributionspakete/Wheels.

```sh
python scripts/build.py
```

Erzeugt ignorierte native Bibliotheken und einen separaten Node-Addon unter
`build/`. Beide Varianten werden getrennt gebaut, damit die C-ABI keine
Node-Laufzeit benötigt. Plattformabhängig `.so`, `.dylib` oder `.dll`.
Für Node entsteht `lyricsbridge.node`. Gebaute Dateien werden nicht committet.

Python: `bindings/python` in `PYTHONPATH` aufnehmen oder das Package lokal
installieren. Nach Installation `LYRICSBRIDGE_LIBRARY` auf die native Bibliothek
setzen; im Quellbaum wird `build/` automatisch gefunden.
Node: `bindings/node/index.js` importieren oder per lokaler `file:`-Abhängigkeit
verwenden. Optional `LYRICSBRIDGE_NODE_LIBRARY` setzen.
Dart: `bindings/dart` als Pfadabhängigkeit verwenden, `dart pub get` ausführen
und `LYRICSBRIDGE_LIBRARY` setzen oder `libraryPath` übergeben.

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
Der Hauptimport `lyricsbridge` nutzt unter Node das native Addon. Browser-Bundler
mit der Bedingung `browser` wählen die WASM-Anbindung. Der explizite Import
`lyricsbridge/web` wählt immer WASM und ist für Browsercode empfohlen.

```typescript
import { init, fromLrc, toLrc, type Document } from 'lyricsbridge/web';

await init();
const document: Document = fromLrc(lrcText, {
  title: 'Titel', artist: 'Interpret',
}).document;
const yaml: string = fromLrc(lrcText, {title: 'Titel', artist: 'Interpret'}).yaml;
const enhancedLrc: string = toLrc(document, {enhanced: true}).output;
```

Nach dem einmaligen asynchronen Laden sind die API-Aufrufe synchron. Alle
Konvertierungen laufen lokal. Ein Web Worker kann dieselbe Web-API verwenden.
Vor `await init()` melden API-Aufrufe einen verständlichen Fehler. Gleichzeitige
Initialisierungen teilen denselben Ladevorgang; nach einem Ladefehler ist ein
neuer Versuch möglich. Wiederholtes `init()` nach Erfolg ist wirkungslos.

Standardmäßig lädt `init()` die WASM-Datei neben dem generierten Loader.
Optional sind URL, Request, Response, BufferSource oder WebAssembly.Module erlaubt,
z. B. `await init(new URL('/assets/lyricsbridge_bg.wasm', location.href))`.
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
