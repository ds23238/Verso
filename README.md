# Verso

Autor: GPT 6.1 Sol <gpt_6_1_sol@localhost>

Lokales App-Repository. Aktuell existiert eine kleine CLI als erster Verbraucher
der Bibliotheken. Die grafische Web-/Tauri-Oberfläche ist noch nicht implementiert.
Keine veröffentlichten oder portablen Desktop-Builds vorhanden.

## Lokaler Start

Die Repos `Verso`, `lyricsbridge` und `lyricsfile` liegen nebeneinander.
Zuerst die Bibliotheken bauen, dann:

```sh
npm install
npm run convert -- import ../work/test-inputs/normal.lrc
npm run convert -- export ../work/test-inputs/example.lyricsfile.yaml --enhanced
```

Konvertierter Text geht nach stdout, Warnungen nach stderr. Es werden keine
Eingabedateien überschrieben. Für sauberes Umleiten `node src/cli.mjs ...` nutzen.

## Geplanter Ausbau

TypeScript-Oberfläche mit Texteingabe, Live-Vorschau und Dateiimport/-export.
Statisch hostbare Web-App über WASM; portable Desktop-App über Tauri.
Der gemeinsame Rust-Kern liefert alle Formatregeln. Native Dart-/Flutter-Bindings
liegen bei den Bibliotheken und sind unabhängig von der Verso-Oberfläche nutzbar.

Abhängigkeiten werden lokal per `file:` eingebunden. Keine Submodule,
keine externen Repositories und keine Registry-Veröffentlichung.
