# Verso

LRC, Enhanced LRC und Lyricsfile direkt auf dem eigenen Gerät konvertieren.
Autor: GPT 6.1 Sol <gpt_6_1_sol@localhost>.

## Implementiert

- Aufgeräumte React-/TypeScript-Oberfläche ohne App-Icon, Light/Dark/System.
- Live-Eingabe, Dateiimport und Drag-and-drop, Beispiele, Metadaten-Overrides.
- LRC/E-LRC ↔ Lyricsfile über die gemeinsamen Rust-/WASM-Bibliotheken im Worker.
- Aktuelle Ausgabe kopieren und als neue UTF-8-Datei exportieren.
- Konkrete Hinweise zu Informationsverlust, explizite Offset-Entscheidung.
- Text-Timing-Vorschau sowie Audio-Arbeitsbereich mit echter Wiedergabe, Seek, Tempo, Wortmarkierung und optionaler Wellenform.
- MP3, FLAC und M4A/AAC lokal lesen; Track-Tags, einzelne Cover und Lyrics bearbeiten.
- Geprüfte Audio-Kopie ohne Neukodierung; Lyricsfile und LRC/E-LRC als Sidecars.
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
npm run audio:build
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

## Nächste Ausbaustufe: Verso Audio

[Audio-/Tag-Konzept](docs/AUDIO_V2_PLAN.md),
[SVG: Audio-Arbeitsbereich](docs/blueprint/audio/workspace.svg) und
[SVG: Änderungen und Speicherziele](docs/blueprint/audio/save-review.svg).

Diese Entwürfe beschreiben FLAC-/MP3-/M4A-Metadaten, Lyrics-Quellen, echte
Audiowiedergabe und gezieltes Zurückschreiben. Die Audiofunktionen sind noch
nicht implementiert.

## Audio-Arbeitsbereich (0.3)

Im Modus **Audio-Datei** eine MP3-, FLAC- oder M4A/AAC-Datei öffnen oder ablegen.
Track-Tags enthalten auch die Cover-Verwaltung: mehrere Bildeinträge auswählen,
einzeln ersetzen, exportieren, hinzufügen oder entfernen. PNG/JPEG bis 8 MiB und
16 Millionen Pixel werden importiert. Andere vorhandene Bilder bleiben erhalten.
Weitere allgemeine Text-Tags können unter „Weitere Tags“ einzeln bearbeitet werden;
unbekannte formatbezogene Felder und binäre Daten bleiben erhalten.

Eingebettete Plain-Lyrics (USLT, Vorbis LYRICS/UNSYNCEDLYRICS, MP4 ©lyr),
LRC-Inhalte dieser Felder, SYLT mit Millisekunden und freie Felder mit „lyricsfile“
im Namen werden als getrennte Quellen angeboten. Bei M4A betrifft Letzteres
freie Text-Atoms. Zusätzlich lassen sich LRC-/Lyricsfile-/Text-Sidecars ausdrücklich
öffnen; der Browser sucht keine Nachbardateien. Jede Quelle behält ihren Entwurf.
Konvertierte Ansichten sind schreibgeschützt und lassen sich als eigener Entwurf
übernehmen. Lyrics-Metadaten werden nur auf Wunsch an Track-Tags angeglichen.

Die Timing-Vorschau verwendet die tatsächliche Audiozeit. Tempo, Lautstärke,
Seek, Zeitausschnitt, Cue-Navigation und Wortmarkierung ändern keine Exportzeiten.
Die optionale Wellenform wird lokal aus PCM berechnet, bei höchstens 10 Minuten
Spieldauer. Die Wiedergabe hängt von den vorhandenen System-/Browser-Codecs ab;
ein Wiedergabefehler verhindert die Tag-Bearbeitung nicht.

Beim Export zeigt eine Prüfung Änderungen und gewählte Sidecars an. Audio wird
als neue `.verso`-Kopie erzeugt. Mehrere Ausgaben liegen in einem ZIP zusammen,
mit passendem gemeinsamen Dateistamm. Im Desktop wählt man dafür einen neuen
Zielpfad; vorhandene Dateien werden nicht überschrieben. Die Audio-Kopie enthält
Tag-/Cover-Änderungen und optional Plain, LRC oder E-LRC aus dem ausgewählten
Entwurf im Standard-Lyrics-Feld. Ein bestimmter Sprach-/Beschreibungs-Eintrag ist
als Ziel wählbar; ohne Auswahl wird nur der erste primäre Eintrag ersetzt oder
neu angelegt. Weitere Varianten und SYLT bleiben erhalten.
Lyricsfile kann unabhängig davon zusätzlich eingebettet werden: FLAC `LYRICSFILE`,
MP3 `TXXX:LYRICSFILE`, M4A `----:org.lyricsfile:LYRICSFILE`. Keine neuen
`com.verso`-Felder. Diese Felder sind eine Interoperabilitäts-Empfehlung, kein
etablierter Lyricsfile-Tag-Standard; andere Player benötigen entsprechende
Unterstützung. Ein vorhandener einzelner kanonischer Eintrag wird ersetzt;
mehrere Einträge führen zum Abbruch, damit keine Variante verloren geht.

Der Exportdialog trennt Audio-Felder und Sidecars, zeigt Quelle und
Konvertierungsverluste und bietet Vorlagen für Tags allein, LRC plus Lyricsfile
in derselben Datei oder Sidecars. Begleitdateien bleiben unabhängig wählbar.
Plain-Lyrics werden auch in der Vorschau als unsynchronisierter Text angezeigt.
Die kompaktere Cover-Verwaltung passt sich an die verfügbare Kartenbreite an.

Der gemeinsame Rust-/WASM-Kern läuft im Worker in Web und Desktop. **Audio ist
in dieser Version auf 64 MiB begrenzt**, weil beide Varianten im Arbeitsspeicher
arbeiten. Eine native Streaming-Variante für größere Dateien ist noch nicht umgesetzt.
Nach dem Schreiben prüft der Kern komprimierte Audio-Payloads (MPEG/FLAC-Frames
bzw. MP4-mdat), allgemeine Tags, Bilder und freie Text-/Binärfelder erneut. Bei
Abweichungen bricht der Export ab. Die Containerstruktur und Tag-Repräsentation
können sich ändern; Audio wird nicht neu kodiert. MP4 ist auf AAC eingeschränkt.
MPEG-Frame-basierte SYLT-Zeiten bleiben erhalten, werden jedoch nicht interpretiert.

Audio-Tests (temporäre synthetische Dateien außerhalb des Repos, ffmpeg erforderlich):

```sh
python scripts/audio-fixtures.py
cargo test --locked --manifest-path audio-core/Cargo.toml
npm run audio:build
npm run build
npm test
```

Actions führt außerdem die Audio-Oberfläche in echtem Chromium aus, prüft
Audio-Wiedergabe, Cover und heruntergeladene Audio-/Sidecar-Ausgaben und erzeugt
Screenshots. `docs/AUDIO_V2_PLAN.md` bleibt der ursprüngliche Entwurf; diese
README beschreibt den implementierten Umfang und seine Grenzen.
