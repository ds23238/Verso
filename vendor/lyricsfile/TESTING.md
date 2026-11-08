# Verifikation des lokalen Entwicklungsstands

- Plattform: Linux x86_64
- Rust: 1.99.1; Python: 3.12.14; Node.js: 24.22.1; Dart: 3.13.7
- `lyricsfile`: 8 Rust-Tests, plus Python-/Node-/Dart-Integrationstest.
- `lyricsbridge`: 10 Rust-Tests, plus Python-/Node-/Dart-Integrationstest.
- Direkter Vergleich aller vier Sprachen für normale LRC, E-LRC und Lyricsfile:
  Dokumente, YAML-/LRC-Ausgaben und Warnungen müssen identisch sein.
- Dart-Analyse mit `--fatal-infos` für beide Packages.
- TypeScript 5.9: strikte Node-Typprüfung ohne DOM, Ausführung der kompilierten
  Node-Beispiele, Browser-Typprüfung mit Bundler-/Browser-Exportbedingungen.
- Echter Chromium-Test: beide WASM-Bibliotheken gegen alle drei externen Dateien;
  Ergebnisse entsprechen Rust, Python, Node und Dart.
- Browser: Fehler vor Initialisierung, parallele Initialisierung, Wiederholung
  nach Ladefehler, individuelle URL/Bytes/Response, Unicode, YAML-/Zeitfehler,
  sichere JavaScript-Ganzzahlen, Web Worker und Konvertierung im Offline-Modus.
- `npm pack --dry-run`: WASM, JS-Loader und TypeScript-Typen im Paket enthalten.
- Verso-CLI: LRC importieren, Lyricsfile als E-LRC exportieren, erneut importieren.

Reproduktion aus `lyricsbridge`:

```sh
LYRICS_TEST_INPUTS=/absoluter/pfad/zu/testdateien python scripts/check.py --build --web
```

Rust/Cargo, Python, Node, Dart und die passende wasm-bindgen-CLI müssen im PATH
liegen. Das Rust-Target `wasm32-unknown-unknown` muss installiert sein. Chromium
wird standardmäßig unter `/usr/bin/chromium` erwartet; alternativ
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` setzen. Ohne `--web` laufen nur die nativen Tests. Die drei externen Dateien
sind absichtlich nicht versioniert. Namen: `normal.lrc`, `enhanced.lrc`,
`example.lyricsfile.yaml`. Der Testordner bleibt außerhalb der Repositories.
Vergleichsergebnisse und Analyzer-Zustand werden neben diesem Ordner abgelegt.

Native Linux-Bibliotheken und Node-Addons liegen lokal im ignorierten `build/`.
Windows/macOS, Android/iOS, Flutter-App-Integration und veröffentlichbare native
Binärpakete sind durch diese Tests nicht abgedeckt. Die JavaScript-/TypeScript-
Browser-Bibliothek ist getestet; eine Dart-/Flutter-Web-Anbindung ist separat.
