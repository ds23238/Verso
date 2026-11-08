# Verso Audio – Konzept für die nächste Ausbaustufe

Status: Funktions- und UI-Entwurf, noch nicht implementiert.
Autor: GPT 6.1 Sol <gpt_6_1_sol@localhost>.
Die bestehende Textkonvertierung bleibt ein eigener, unveränderter Arbeitsmodus.

## Produktidee

Eine Audiodatei öffnen, vorhandene Lyrics und Tags verstehen, einen Entwurf
bearbeiten, mit dem echten Audio prüfen und gezielt als neue Datei speichern.
Verso bleibt lokal, ohne Konto, Upload, Online-Lyrics-Suche oder Neukodierung.
Kein neues Logo und kein Fokusrahmen im Editor.

Zwei Modi in der Kopfzeile: **Text konvertieren** und **Audio-Datei**.
Ein Arbeitsbereich enthält zunächst genau einen Track. Das vermeidet eine
zusätzliche Bibliotheksverwaltung, bevor der Datei-Workflow zuverlässig ist.

## Was „Lyrics auslesen“ tatsächlich bedeutet

Container, Audio-Codec, Lyrics-Inhalt und Ablageort sind getrennte Eigenschaften.
M4A ist ein Container und enthält nicht zwangsläufig AAC. Vor Verarbeitung werden
Dateisignatur und Codec geprüft; die Endung allein entscheidet nicht.

| Audioformat | Plain-Lyrics | Synchronisierte Lyrics | Lyricsfile |
| --- | --- | --- | --- |
| MP3 / ID3v2 | `USLT`; Sprache und Beschreibung als eigene Einträge erhalten | `SYLT` bei unterstützter Zeitbasis; außerdem vorhandene LRC-Texte in bekannten benutzerdefinierten Feldern/Begleitdateien | Begleitdatei; zusätzlich bewusst gewähltes benutzerdefiniertes Feld |
| FLAC / Vorbis Comments | häufig `LYRICS` oder `UNSYNCEDLYRICS`; Konventionen unterscheiden sich | LRC in Begleitdateien oder erkannten Textfeldern; keine universell vorgeschriebene Lyrics-Zuordnung | Begleitdatei; optional eigenes Vorbis-Feld |
| M4A / AAC in MP4 | verbreitetes Textatom `©lyr` | LRC-Begleitdatei oder erkannte Freeform-Felder; kein hier vorausgesetzter allgemeiner Standard für Wortzeiten | Begleitdatei; optional eigenes MP4-Freeform-Feld |

Plain-Text darf keine Synchronisation vortäuschen. Auch `USLT`, `LYRICS` oder
`©lyr` können in der Praxis LRC-Text enthalten: Inhalt untersuchen und als
abweichende Konvention kennzeichnen, statt Text allein anhand des Feldnamens
falsch zu interpretieren. Mehrere Sprachen, Beschreibungen und doppelte Werte
bleiben eigenständige Einträge.

Lyricsfile hat in den herangezogenen Quellen keine hier nachgewiesene,
standardisierte Einbettung für diese drei Container. **Begleitdateien sind der
interoperable Standardweg in Verso.** Eigene Einbettung wäre ein ausdrücklich
markiertes Verso-Profil, keine Zusage zur Unterstützung durch andere Player.
Mögliche Feldnamen werden vor Implementierung festgelegt und versioniert;
der Blueprint schreibt keine vermeintlichen Standard-Tags vor.

Bei ID3-SYLT sind Zeitmarken nicht automatisch Millisekunden: MPEG-Frame-Zeitbasen
benötigen eine nachweislich korrekte Umrechnung. Zunächst nur die geprüften
Varianten importieren, andere Einträge roh erhalten und verständlich erklären.
SYLT-Segmente können Wörter oder Textteile darstellen; Zeilen-/Wortgrenzen dürfen
nicht frei erfunden werden. Keine neuen Zeiten aus Plain-Lyrics erzeugen.

## Quellenmodell

Eine Audio-Datei kann gleichzeitig mehrere unabhängige Lyrics-Versionen besitzen:

- eingebettete Plain-Lyrics;
- eingebettete synchronisierte Lyrics oder ein LRC-Text;
- separat ausgewählte `.lrc`- oder `.lyricsfile.yaml`-Dateien.

Jede Quelle bekommt Herkunft, Format, Sprache/Beschreibung und einen eigenen
Entwurf. Quellen werden nicht automatisch zusammengeführt oder überschrieben.
Ein sichtbarer Quellenwähler bestimmt, welches Dokument gerade bearbeitet wird.
Die Ansichten **Text / LRC / Lyricsfile** zeigen dessen Darstellungs-/Exportformat,
nicht drei zusätzliche unabhängige Originalquellen.

Bekannte Textfelder können zusätzlich anhand ihres Inhalts als LRC oder gültiges
Lyricsfile erkannt werden. Das Originalfeld mit Name, Sprache und Beschreibung
bleibt dabei identifizierbar; binäre Tags werden nicht als Lyrics geraten.

Track-Tags und Metadaten des Lyricsfile bleiben zunächst getrennt. Ein optionaler
Abgleich wird im Speicherdialog ausdrücklich ausgewiesen, statt Quellen still
aufeinander abzustimmen.

Ein Wechsel des Anzeigeformats darf keine Daten im internen Dokument verwerfen.
Kann ein Format nicht alle Informationen darstellen, zeigt die UI dies an und
behält das vollständige Ursprungsmodell. Editieren einer verlustbehafteten Ansicht
ist erst nach expliziter Übernahme als neuer Entwurf möglich. Vorschau allein
schreibt weder Tags noch Begleitdateien.

Browser dürfen Nachbardateien nicht einfach durchsuchen. Dort müssen Begleitdateien
mit ausgewählt oder ausdrücklich über einen Verzeichnisdialog freigegeben werden.
Der Desktop kann Dateien mit gleichem Basisnamen anbieten, wenn die dazu nötige
Leseerlaubnis besteht. Die abgebildete Begleitdatei wurde bereits bewusst geöffnet.

## Hauptansicht

**Oben:** Trackname, Format/Codec/Dauer und Status der Änderungen. Aktionen
„Datei öffnen“, „Änderungen prüfen“ und „Speichern als…“.

**Links:** direkt bearbeitbare häufige Tags: Titel, Interpret, Album, Albuminterpret,
Track/Disc, Jahr, Genre. „Weitere Tags“ öffnet eine Ansicht aller vorhandenen Werte,
Sprachen und Mehrfachfelder. Unbekannte/binäre Felder bleiben roh erhalten;
Cover erhalten einen eigenen Bereich mit Vorschau und Bearbeitungsaktionen.

**Rechts:** Quellenwähler, Editoransicht, Herkunft und Zeitauflösung. Änderungen
bleiben zunächst in einem gemeinsamen Arbeitsentwurf. Für Import/Export werden
die vorhandenen Konvertierungsbibliotheken verwendet.

**Unten:** echter Audioplayer mit Play/Pause, Zeit, Seek, Lautstärke und
Geschwindigkeit. Die aktuelle Audiozeit steuert die Lyrics-Hervorhebung.
Wellenform optional und lazily berechnet; sie ist kein Nachweis für erkannte
Wort- oder Zeilengrenzen. Der Blueprint zeigt eine schematische Wellenform.

Auf schmalen Bildschirmen: Tabs **Lyrics / Tags / Speichern**, darunter bzw. am
unteren Rand ein kompakter Audioplayer. Keine drei zusammengedrückten Spalten.

## Cover und weitere eingebettete Bilder

Ein eigener Bereich zeigt das ausgewählte Bild, seine Rolle soweit vorhanden,
Bildanzahl, Format, Auflösung und Dateigröße. Aktionen: **Hinzufügen** (bei fehlendem
Cover), **Ersetzen**, **Entfernen**, **Exportieren** und **alle Bilder ansehen**.
Die exportierte Bilddatei verwendet die Originalbytes, soweit das Format dies zulässt.
Die Abbildung verwendet bewusst ein schematisches Albumcover, kein Verso-App-Icon.

- MP3: Bilder aus ID3-`APIC`-Frames; Bildtyp und Beschreibung erhalten.
- FLAC: native `PICTURE`-Metadatenblöcke samt Bildtyp/Beschreibung erhalten.
- M4A: Bilder aus `covr`; mehrere Bilder und ihre Reihenfolge erhalten. MP4 hat
  dort nicht dieselben Front-/Rückseiten-Rollen wie ID3/FLAC. Die UI darf eine
  Anzeigewahl nicht als vorhandenes Typ-Tag ausgeben.
- Mehrere Bilder werden einzeln adressiert. „Frontcover ersetzen“ verändert
  nicht automatisch Rückseite, Booklet oder andere vorhandene Bilder.
- Entfernen ist zunächst nur eine Entwurfsänderung und rückgängig machbar.
  Erst Speichern verändert die ausdrücklich gewählte Audiokopie bzw. das Original.
- JPEG und PNG als erste Importformate; Signatur, tatsächlich dekodierbare Daten,
  Auflösung und Ressourcenlimits prüfen. Nicht unterstützte Bildformate ablehnen
  oder eine ausdrückliche Konvertierung anbieten; nicht still neu kodieren,
  zuschneiden oder verkleinern.
- Ohne Cover-Änderung bleiben vorhandene Bilddaten möglichst bytegenau erhalten.
  Cover werden nicht in LRC oder das derzeitige Lyricsfile-Schema hinein erfunden.

Die Speicherübersicht zeigt für eine Cover-Änderung **Vorher/Nachher**, Ersetzen
oder Entfernen und den Erhalt anderer Bilder. Das abgebildete Frontcover wird
nur in der neuen Audiokopie ersetzt. Ein Bildexport ist eine separate Aktion;
die drei geplanten Dateien bleiben Audiokopie plus zwei Lyrics-Begleitdateien.

## Speichern als überprüfbarer Vorgang

Ein eigener Speicherdialog zeigt jede geplante Ausgabe:

| Ziel | Voreinstellung |
| --- | --- |
| Audiokopie | neue Datei mit gleichem Audioformat; bearbeitete Track-Tags übernehmen |
| Plain-Lyrics im Audiotag | nur auf Wunsch aus dem ausgewählten Entwurf ableiten; vorhandene Einträge explizit ersetzen/erhalten |
| LRC-Begleitdatei | optional; Verlust vorhandener End-/Wortzeiten abhängig vom gewählten LRC-Profil anzeigen |
| Lyricsfile-Begleitdatei | vollständiges unterstütztes Lyricsfile-Dokument speichern |
| Eigene Lyricsfile-/LRC-Einbettung | Expertenoption mit Hinweis auf begrenzte Player-Unterstützung |

Beispiel: `abendlicht.verso.flac`, `abendlicht.verso.lrc` und
`abendlicht.verso.lyricsfile.yaml`. Nach Änderung des Audio-Zielnamens passen sich
Begleitdateinamen an. Der Nutzer sieht vor dem Schreiben die tatsächlichen Pfade.

„Original ersetzen“ ist eine separate, ausdrückliche Desktop-Option. Erst in eine
Temporärdatei schreiben, erneut lesen und prüfen, dann auf demselben Dateisystem
atomar ersetzen, soweit unterstützt. Ein Backup kann zusätzlich angeboten werden.
Bei mehreren Ausgabedateien ist ein global atomarer Commit nicht garantiert:
vorbereiten, einzeln finalisieren und Teilerfolge/Fehler pro Datei ausweisen.
Ein erfolgreiches Audio-Speichern darf einen fehlgeschlagenen Sidecar-Export nicht
verdecken. Browser-Fallback: Audiokopie herunterladen; mehrere Ergebnisse bei Bedarf
als gemeinsames Exportpaket, statt ungefragt viele Downloads zu starten.

## Technischer Aufbau

- `lyricsfile` bleibt das Formatmodell; `lyricsbridge` bleibt Textkonvertierung.
- Eine neue Audio-/Tag-Komponente im Verso-Repository übernimmt Containeranalyse,
  Quellenerkennung und verlustarmen Metadaten-Patch. Kein viertes Repository nötig.
- Rust-Tag-Bibliotheken wie `lofty` als Kandidaten evaluieren, einschließlich
  formatnaher APIs für nicht allgemein abbildbare Felder. Keine Zusage zum
  Erhalt aller unbekannten Tags ohne Roundtrip-Tests.
- Desktop: Rust arbeitet auf ausdrücklich gewählten Dateien, nicht auf per IPC
  komplett Base64-kodierten Audioblöcken. Wiedergabe über sicheren lokalen
  Medienzugriff mit Range-Unterstützung.
- Web: Audio als lokale Blob-URL; Parser/Writer im Worker über WASM. Große Dateien
  stückweise lesen; Random-Access-Schreiben und OPFS-/Dateisystem-APIs evaluieren.
  Ein Speicherlimit wird erst nach Messungen festgelegt. Das bisherige 2-MiB-Limit
  für Lyrics darf nicht einfach auf Audio angewendet werden.
- Standardwiedergabe über den Browser-/WebView-Audiodecoder, Audiofähigkeit am
  konkreten Gerät prüfen. Taglesen kann auch ohne verfügbaren Decoder funktionieren.
  Einen zusätzlichen Rust-Decoder erst bei nachgewiesenen Codec-Lücken vorsehen.
- AAC-Profile, MP3-Encoderverzögerung, Gapless-Metadaten und AAC-Priming testen.
  Maßgeblich ist die Wiedergabezeit; gespeicherte Zeitmarken werden nicht
  automatisch um eine vermutete Decoderverzögerung verschoben.

Ein Audio-Tag-Patch darf den komprimierten Audiostrom nicht neu kodieren.
„Unverändert“ wird mit Audio-Payload-/Sample-Hashes und Decoderprüfungen getestet,
nicht mit einem Hash der ganzen Datei: Tags und Container-Offsets ändern sich.
Cover, unbekannte Tags, Mehrfachwerte und nicht bearbeitete Containerteile werden
nur dort als erhalten behauptet, wo die gewählte Bibliothek dies nachweislich tut.
Nicht sicher erhaltbare Strukturen führen zu einer Warnung bzw. einem Schreibstopp.

## Schritte und Abnahme

1. **Audio lesen und abspielen:** drei Container erkennen, Codecs anzeigen,
   Standard-Tags und unabhängige Lyrics-Quellen auslesen, Wiedergabe/Scrubbing.
2. **Sicheres Tag- und Cover-Schreiben:** FLAC, MP3 und M4A jeweils separat freigeben;
   temporäre Audiokopie schreiben, erneut lesen, Payload und unberührte Tags prüfen.
3. **Lyrics-Ziele:** native Plain-Tags und Sidecars; danach geprüfte SYLT-Varianten
   und bewusst gewählte benutzerdefinierte Einbettungen.
4. **Oberfläche und Fehlerpfade:** Änderungenübersicht, Rückgängig, Quellkonflikte,
   Decoderfehler, schreibgeschützte Dateien, abgebrochene Speichervorgänge.
5. **Plattformtests:** Chromium sowie native Linux-WebKit- und Windows-WebView2-
   Tests mit kleinen selbst erzeugten Audiodateien, mehreren Tags/Sprachen,
   mehreren Coverbildern, JPEG/PNG, fehlendem Cover, gezieltem Ersetzen/Entfernen,
   bytegenauem Erhalt unberührter Bilder und echten Audio-Seek-/Metadaten-Roundtrips.

Kein Album-Batch, kein automatisches Timing und keine Audio-Neukodierung im ersten
Audio-Release. Audio- und Lyrics-Änderungen werden getrennt nachvollziehbar.

## Blueprint-Dateien

- `blueprint/audio/workspace.svg`: Hauptarbeitsbereich mit geladenem Audio.
- `blueprint/audio/save-review.svg`: konkrete Speicherziele und Änderungsübersicht.

Beides sind statische Designentwürfe; dargestellte Audiodaten und Wellenform sind
Beispielwerte und keine bereits implementierten Audiofunktionen.

## Technische Referenzen

- ID3v2.4 Frames: https://id3.org/id3v2.4.0-frames (`USLT`, `SYLT`).
- Vorbis Comment: https://xiph.org/vorbis/doc/v-comment.html (erweiterbare Felder;
  kein dort vorgeschriebenes universelles Lyrics-Schema).
- MP4-Tag-Abbildung/Freeform: https://github.com/quodlibet/mutagen/blob/main/mutagen/mp4/__init__.py
  (`©lyr`, `----:mean:name`).
