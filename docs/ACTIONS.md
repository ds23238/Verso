# GitHub Actions

Repository: https://github.com/ds23238/Verso
Workflow: `.github/workflows/ci.yml` → **Build and test Verso**.
Er startet bei Push auf `main`, Pull Requests oder manuell per `workflow_dispatch`.

## Was geprüft wird

1. **Libraries, web and Chromium**: Quellcode-Snapshots prüfen und als eigenständige
   Nachbarverzeichnisse bereitstellen, temporäre Beispiele außerhalb des Checkouts
   erzeugen, native und WASM-Bibliotheken bauen. Rust, Python, Node.js, Dart und
   Browser-Ergebnisse vergleichen; Node-/Browser-TypeScript prüfen.
2. Die App bauen, Komponenten-/Hook-/Worker-Tests ausführen und die tatsächlich
   gebaute Oberfläche in Chromium prüfen: Dateien, Metadaten, Fehler, Download,
   Zwischenablage, Vorschau, Dark Mode, mobile Tabs und Drag-and-drop.
   Audio: synthetische MP3-/FLAC-/AAC-Fixtures außerhalb des Repos erzeugen;
   Rust-Rundläufe mit Audio-Payload-Hash, Tag-/Cover-Erhalt, SYLT und freiem
   Lyricsfile-Feld prüfen. Chromium prüft Audio-Tags, einzelne Cover, Sidecar-ZIP,
   heruntergeladene Dateien, echte Wiedergabe, Wortmarkierung und Wellenform.
3. **Portable linux/windows**: passende Systemwerkzeuge und Desktop-Abhängigkeiten
   installieren, Tauri nativ kompilieren und portable Dateien archivieren.
4. Native WebDriver-Tests starten die echte Anwendung und prüfen ihre WebView,
   CSP-/Worker-/WASM-Anbindung, Live-Konvertierung, Audio-Import und Cover-Dekodierung. Native Betriebssystem-
   Datei- und Speicherdialoge sind nicht Bestandteil dieser automatischen Tests.

Die Chromium-Screenshots zeigen die fertige Oberfläche, keine SVG-Blueprints.
Ein grüner Web-Lauf alleine bestätigt noch keinen erfolgreichen Desktop-Build.
Portable Artefakte werden bereits nach erfolgreicher Kompilierung hochgeladen;
für ihren vollständigen Smoke-Test den nachfolgenden Jobstatus prüfen.

## Artefakte

| Name | Inhalt |
| --- | --- |
| `verso-web` | Gesamter statisch hostbarer Web-Ordner, inklusive WASM |
| `verso-engine` | Lyrics- und Audio-WASM/Loader für die Desktop-Jobs |
| `verso-audio-fixtures` | Temporär erzeugte synthetische Audio-Dateien für native Tests |
| `verso-browser-report` | Chromium-Screenshots für Desktop, Mobile und Dark Mode sowie Bericht |
| `verso-linux-x64` | Linux-TAR mit ausführbarer Datei und Laufzeithinweisen |
| `verso-windows-x64` | Windows-ZIP mit portabler EXE und Laufzeithinweisen |
| `verso-native-report-linux/windows` | Native Screenshots, Smoke-Testbericht und Driver-Logs |

Retention: 14 Tage. Artefakte werden über die Seite des jeweiligen Actions-Laufs
heruntergeladen und nicht automatisch als dauerhafter GitHub Release publiziert.
Linux benötigt WebKitGTK/GTK-Laufzeitbibliotheken; Windows WebView2.

## Separat gepflegte Bibliotheken

Die ursprünglichen lokalen Repositories bleiben eigenständig. `vendor/` enthält
nur versionierte Quellcode-Snapshots, keine Git-Metadaten, WASM-/Node-/Python-
Binärdateien oder Test-Eingabedateien. `manifest.json` hält Commit-IDs und SHA-256-
Prüfsummen fest; `.gitattributes` garantiert identische Checkout-Bytes auf Windows.

Ein frischer Checkout funktioniert mit:

```sh
python scripts/bootstrap-libraries.py
npm ci
```

Vorhandene Nachbar-Repositories werden nicht überschrieben. Änderungen an den
Bibliotheken zuerst in deren eigenen Repositories committen, dann bewusst
`python scripts/snapshot-libraries.py` ausführen und Versos Snapshot-Update prüfen.

Desktop-Jobs übernehmen die im Web-Job getesteten WASM-Artefakte über
`VERSO_ENGINE_DIR`. Sie benötigen dafür keine plattformspezifischen Node-Addons.

## Nach einem Fehler

Im fehlgeschlagenen Schritt den konkreten Fehler und gegebenenfalls die
Report-Artefakte prüfen. Ein erneuter Lauf gleicher Quellen eignet sich für
Netzwerk-/Runnerprobleme; Quellcodefehler erfordern einen Fix und neuen Push.
Der Workflow besitzt nur `contents: read` und benötigt keine zusätzlichen Secrets.
