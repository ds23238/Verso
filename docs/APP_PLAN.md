# Verso – App-Plan

Status: ursprünglicher Umsetzungsplan; die Web-GUI ist inzwischen implementiert.
Web- und portable Desktop-Builds sowie native Smoke-Tests sind inzwischen in
GitHub Actions verifiziert (siehe README, ACTIONS.md und DESKTOP.md). Autor: GPT 6.1 Sol
<gpt_6_1_sol@localhost>. Die vorhandene CLI bleibt unverändert.

## Ziel und Abgrenzung

Eine kleine, lokal arbeitende Konvertierungs-App für LRC/E-LRC ↔ Lyricsfile.
Text einfügen oder eine Datei öffnen, Ergebnis sofort verstehen, sicher exportieren.
Dieselbe Oberfläche läuft als statisch hostbare Website und als portable
Desktop-Anwendung für Linux und Windows. Kein Benutzerkonto und kein Server
für die Konvertierung. Beim ersten Webaufruf werden App und WASM geladen;
offline nach einem Neustart erfordert später einen ausdrücklich implementierten
App-Cache. Die bereits getestete WASM-Konvertierung funktioniert nach dem Laden offline.

MVP: einzelne Datei oder Live-Eingabe, Metadaten, formatierte Ausgabe, zeitliche
Simulation, Diagnosen, Kopieren und Exportieren. Kein Lyrics-Editor mit neuem
Timing, keine automatische Texterkennung, keine erfundenen Zeiten.
Stapelverarbeitung, Audio-Vorschau und installierbare Pakete sind spätere Schritte.

## Nutzerablauf

1. Leeren Arbeitsbereich öffnen oder Beispiel laden. Datei per Dialog oder
   Drag-and-drop einlesen; alternativ direkt im Texteingabefeld schreiben.
2. Dateiendung und Inhalt schlagen ein Format vor. Bei uneindeutiger Eingabe
   muss eine manuelle Auswahl möglich bleiben. LRC/E-LRC sind ein gemeinsamer
   Eingabetyp; vorhandene Wortmarker werden als E-LRC erkannt.
3. Titel und Interpret aus Tags übernehmen. Fehlende Pflichtfelder in sichtbaren
   Feldern ergänzen; Änderungen wirken als explizite Overrides. Album optional.
4. Ziel wählen: Lyricsfile, LRC oder E-LRC. E-LRC-Export erhält vorhandene
   Wortanfänge; ohne solche Marker meldet die UI, dass nur Zeilenzeiten vorhanden sind.
5. Live konvertieren; strukturierte Diagnose neben Ergebnis und Exportaktion zeigen.
   Vorhandene Warnungen blockieren gültige Exporte nicht. Fehler blockieren den Export.
6. Ergebnis kopieren oder als neue UTF-8-Datei exportieren. Nie die Eingabedatei
   automatisch überschreiben. Exportname wird aus dem Eingabenamen abgeleitet.

Beim Richtungswechsel bleiben die bisherigen Entwürfe im Speicher erhalten.
Eine gültige letzte Ausgabe kann als neue Eingabe übernommen werden. Bei ungültiger
Eingabe wird kein alter Export als aktuell ausgegeben.

## Funktionsumfang des ersten Releases

| Bereich | Verhalten |
| --- | --- |
| Eingabe | Text, Dateidialog, Drag-and-drop; eine Datei zur Zeit; UTF-8 mit/ohne BOM |
| Ausgabe | Read-only Textansicht, Kopieren, Download/Speichern als neue Datei |
| Formate | LRC/E-LRC → Lyricsfile und Lyricsfile → LRC/E-LRC |
| Metadaten | Titel, Interpret, Album; Herkunft aus Datei vs. manuell überschrieben sichtbar |
| Offset | Nicht-null LRC-Offset verlangt Auswahl: anwenden oder ignorieren; Standard keine implizite Änderung |
| Diagnosen | Fehler mit verfügbaren Positionen; Warnungen vor Export und bei betroffener Option |
| Live-Vorschau | Simulierter Zeitcursor, Start/Pause, Scrubbing; keine Audiodatei erforderlich |
| Bedienung | Tastatur, sichtbarer Fokus, beschriftete Controls, Light/Dark/System |
| Datenschutz | Inhalte bleiben lokal; keine Telemetrie, keine externen Schrift-/Icon-CDNs |
| Entwürfe | Standard nur im Arbeitsspeicher; persistentes Merken später als ausdrückliche Option |

Dateien über dem Bibliothekslimit von 2 MiB werden vor dem Parsen abgewiesen.
Ungültiges UTF-8 wird mit Hinweis abgelehnt; keine stille Ersatzzeichendekodierung.
Bibliothekslimits und endgültige tatsächliche Dateigröße gelten auch beim Export-
oder Metadaten-Workflow, sofern ein neuer Parse angestoßen wird.

## Technischer Aufbau

- **Oberfläche:** React + TypeScript, Vite, CSS-Variablen; keine Server-Komponenten.
  Native Textareas mit sauberer Monospace-Schrift zuerst; ein schwerer Code-Editor
  ist für die begrenzte Dateigröße und diesen Umfang zunächst nicht erforderlich.
- **Browser:** `lyricsbridge/web` und `lyricsfile/web` in einem Modul-Web-Worker;
  einmalige WASM-Initialisierung und anschließend Nachrichten mit Request-ID.
- **Desktop:** Tauri 2 mit demselben UI. Zunächst derselbe Worker-/WASM-Weg für
  identisches Verhalten; Tauri übernimmt Dateidialoge und kontrollierten Zugriff
  auf explizit ausgewählte Dateien. Ein direkter Rust-Adapter bleibt möglich,
  benötigt aber keinen zweiten Konvertierungspfad im ersten Release.
- **Dateiadapter:** Browser-File-API/Blob-Download und Tauri-Dialog/Datei-API hinter
  einer gemeinsamen Schnittstelle. Browser brauchen keine zusätzlichen Dateisystemrechte.
- **Abhängigkeiten:** die drei bestehenden Repos bleiben getrennt. Lokale `file:`-
  Dependencies für npm und Cargo-Pfadabhängigkeiten bei Desktop-Builds; keine Submodule.
- **Build:** zuerst Bibliotheks-WASM bauen, dann Vite; Webartefakt ist statisch.
  Desktop-Builds auf Linux und Windows jeweils nativ. Keine ungeprüfte Zusage,
  dass ein Linux-Build automatisch ein funktionierendes Windows-Kompilat erzeugt.

Geplante Ergänzungen im bestehenden Repository, ohne die CLI zu entfernen:

```text
src/
  app/                 App, Zustand und Hooks
  components/          EditorPane, FormatBar, MetadataFields, Diagnostics, Preview
  conversion/          Worker, Nachrichtenprotokoll, TypeScript-Adapter
  platform/            browser.ts, tauri.ts, Datei-/Clipboard-Schnittstellen
  styles/              Tokens, Layout, Themes
src-tauri/             Desktop-Hülle und eng begrenzte Berechtigungen
public/                lokale Icons und WASM-Assets, sofern der Bundler sie dort braucht
docs/                  Plan, Design und Abnahme
```

## Live-Verarbeitung und Zustände

UI-Zustand: Eingabetext, erkanntes/gewähltes Format, Zielformat,
Metadaten-Overrides, Offset-Auswahl, Eingaberevision, Diagnosen, gültiges Ergebnis,
Vorschauzeit und Worker-Ladestatus. Der Eingabetext bleibt die maßgebliche Quelle.
Ein einzelner zentraler State-/Reducer-Ansatz genügt; keine zusätzliche globale
State-Bibliothek zum Start.

- Nach Texteingabe etwa 200 ms entprellen; Metadatenänderungen ebenso.
- Requests erhalten steigende IDs. Antworten veralteter Revisionen verwerfen.
- Nur die jüngste wartende Revision nach einer laufenden Konvertierung anstoßen;
  große alte Requests nicht beliebig aufstauen.
- Beim Bearbeiten Ausgabe als „Wird aktualisiert“ markieren und Export kurz sperren.
- Bei Fehlern kann ein vorheriges Ergebnis als ausdrücklich veraltet sichtbar
  bleiben; es darf nicht über die aktuelle Exportaktion gespeichert werden.
- Unterscheiden: WASM lädt, leer, konvertiert, gültig, gültig mit Warnungen,
  ungültig, Ladefehler. Ladefehler bieten Wiederholen.

Die Bibliotheken liefern aktuell teils strukturierte Diagnosen und teils
Fehlertexte. Der UI-Adapter vereinheitlicht dies zunächst. Klickbare Zeilenmarker
werden nur für tatsächlich bekannte Quellpositionen angeboten. Strukturierten
Fehlercode/Quellposition in Rust zu ergänzen ist ein möglicher Bibliotheksnachtrag;
die App soll keine Positionen aus unsicheren Heuristiken erfinden.

## Timing-Vorschau

Die Vorschau simuliert Wiedergabe mit einem Zeitcursor. Existierende explizite
Endzeiten werden beachtet; überlappende aktive Zeilen bleiben sichtbar.
Ohne Endzeit kann die Darstellung bis zum nächsten Start fortgesetzt werden.
Für die letzte Zeile dient die Dauer, falls vorhanden, oder ein klar als
Darstellungsregel behandelter Auslauf. Diese Grenzen sind nur Anzeigehilfen und
werden niemals in das exportierte Dokument geschrieben.

Bei Wörtern gilt dasselbe: vorhandene Anfänge zur Hervorhebung verwenden,
fehlende Endzeiten ausschließlich visuell behandeln. Ein Dokument ohne Wortzeiten
erhält eine Zeilen-Vorschau. Reine Plain-Lyrics werden ohne Zeitsteuerung angezeigt.

## Rückexport und Informationsverlust

Warnungen nennen den konkreten Verlust: Wortzeiten beim normalen LRC-Export,
Endzeiten, Sprache/Erweiterungen oder eine abweichende separate Plain-Version.
Warnungsanzahl allein genügt nicht. Ein optionaler Export als E-LRC wird dort
angeboten, wo er vorhandene Wortanfänge erhalten kann.

Ein nicht-null `Lyricsfile.offset_ms` verhindert aktuell den LRC-Export. Die UI
zeigt den Bibliotheksfehler; sie wendet keine selbst erfundene Offset-Semantik an.
Instrumentalstatus und nicht darstellbare Text-/Marker-Kombinationen bleiben
entsprechend dem Bibliotheksverhalten blockiert.

## Umsetzung in überprüfbaren Schritten

| Schritt | Ergebnis | Abnahme |
| --- | --- | --- |
| 1. Fundament | Vite/React, Worker, Plattformadapter, lokaler Build | WASM-Assets laden; Worker konvertiert die drei externen Testdateien |
| 2. Arbeitsbereich | Zwei Editoren, Formatwahl, Metadaten, Live-Konvertierung | beide Richtungen funktionieren; ungültige Revision exportiert keinen alten Text |
| 3. Transparenz | Diagnosen, Offset-Auswahl, Informationsverlust, Kopieren/Download | Hinweise korrekt; Exportnamen und Unicode bleiben erhalten |
| 4. Vorschau | Zeitcursor, Wort-/Zeilenhervorhebung, responsive Tabs, Tastatur | Scrubbing ändert keine Daten; mobile und Desktop-Bedienung geprüft |
| 5. Desktop | Tauri-Dateiadapter und portable Linux-/Windows-Artefakte | auf beiden Zielsystemen starten, öffnen und exportieren; Bibliotheksergebnisse identisch |
| 6. Später | Batch, optionale Audio-Datei, Entwurfspeicherung, Installer | separat konkretisieren; kein Bestandteil der ersten GUI-Umsetzung |

Tests konzentrieren sich auf App-Verhalten: veraltete Worker-Antworten,
Metadaten-Overrides, Downloadinhalt und Warnungen, Offset-Entscheidungen,
Dateidekodierung, Keyboard und Export-Sperren. Die Konvertierungsregeln selbst
bleiben in den vorhandenen Bibliothekstests. Zusätzlich Chromium-End-to-End-Tests
und reale Windows-/Linux-Starttests für portable Desktop-Pakete.

## Design-Artefakte

`UI_BLUEPRINT.md` beschreibt Raster, Komponenten, Zustände und Barrierefreiheit.
`blueprint/desktop.svg` und `blueprint/mobile.svg` zeigen statische Ansichten.
Die Ansichten sind ein Entwurf und enthalten keine interaktive Anwendung.
