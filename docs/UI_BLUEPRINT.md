# Verso – UI-Blueprint

Status: statischer Gestaltungsentwurf. Kein Screenshot einer fertigen App.

## Visuelle Richtung

Ruhiges Werkzeug mit großzügigem Abstand, warmem Off-White, dunkler Tinte und
Teal als Hauptakzent. Große, klare Überschriften; Codeflächen bleiben kompakt und
kontrastreich. Kein Dashboard mit nutzlosen Kennzahlen und keine permanente
Navigation: der Arbeitsbereich ist die App.

| Token | Wert / Verwendung |
| --- | --- |
| Hintergrund | `#F4F5F1` |
| Oberfläche | `#FFFFFF` |
| Text | `#172D2B` |
| Sekundärer Text | `#536861` |
| Akzent | `#146B59`, weiße Schrift auf primären Aktionen |
| Akzentfläche | `#E6F2EC` |
| Rahmen | `#D8E1DA` |
| Warnung | dunkler Bernstein auf `#FFF4DB` |
| Fehler | dunkles Rot auf `#FDECE9` |
| Schrift | lokale/systemeigene Sans-Serif; System-Monospace für Code |
| Radien | 12–16 px für Panels, 8 px für Eingaben |
| Abstände | Basis 4 px, Hauptabstände 16 / 24 / 32 px |

Farben sind Entwurfswerte; Textkontrast wird vor Umsetzung mindestens auf
WCAG-AA geprüft. Fokus, Fehler und Status werden zusätzlich durch Text und
Formen vermittelt. Dark Mode braucht eigene, geprüfte Tokens.

## Desktop: Lesereihenfolge

1. **Kopf:** Verso, „Lyrics converter“, lokaler Verarbeitungsstatus; Hilfe und Theme.
2. **Arbeitsauftrag:** „Dein Text. Im richtigen Format.“
3. **Formatleiste:** Quelle, Richtungswechsel, Ziel; Datei öffnen und Exportieren.
4. **Metadaten:** Titel, Interpret, Album, Herkunft der Werte bzw. Override-Status.
5. **Zwei Editor-Panels:** links Eingabe, rechts Ausgabe; aktuelle Dateinamen,
   Zeilennummern als visuelle Orientierung, Kopieren im Ausgabekopf.
6. **Diagnosen:** sichtbare Zusammenfassung und ausklappbare konkrete Meldungen;
   Formatverlust außerdem am relevanten Exportformat erklären.
7. **Timing-Vorschau:** Cursor/Abspielen, Zeit, Scrubber, aktuelle Lyrics.
8. **Fuß:** Kodierung, Präzision, Stand der Konvertierung.

Die exportierte Textausgabe bleibt read-only. Bearbeitet wird die Quelle;
vermeidet zwei gleichzeitig konkurrierende Dokumentversionen.

## Responsive Verhalten

- Ab etwa 1100 px zwei gleich breite Editoren; Preview darunter über volle Breite.
- Dazwischen weiterhin zwei Spalten, solange jede nutzbar bleibt; Metadaten umbrechen.
- Unter etwa 900 px: Tabs „Eingabe“, „Ergebnis“, „Vorschau“. Kein horizontal
  zusammengedrückter Split. Tabwechsel erhält Text, Cursor und Scrollposition.
- Unter 600 px: Titel/Interpret in einer kompakten, zugänglichen Metadaten-Sektion,
  große Touchziele, Primäraktion am unteren Rand mit Platz für Safe Areas.
- Codezeilen dürfen innerhalb des Editors horizontal scrollen; die Seite selbst nicht.
- Export ist immer erreichbar; Fehler-/Warnstatus bleibt auch bei inaktivem Ergebnistab sichtbar.

## Wichtige Zustände

| Zustand | Anzeige / Aktion |
| --- | --- |
| Leer | „Datei öffnen, Text einfügen oder Beispiel laden“; Export deaktiviert |
| WASM lädt | „Konverter wird geladen“; Eingabe bereits möglich |
| Verarbeitung | Ergebnis als ausstehend markieren; keine veralteten Exporte |
| Gültig | grüner Textstatus, aktuelle Ausgabe und Export aktiv |
| Warnungen | konkreter Verlust mit Alternativen; Export bleibt möglich |
| Fehler | Ursache und bekannte Position; Eingabe bleibt erhalten, Export gesperrt |
| Fehlende Metadaten | Titel-/Interpretfelder direkt hervorheben |
| Offset | „Vorhandener LRC-Offset: +/− N ms“; Anwenden/Ignorieren explizit wählen |
| Laden gescheitert | Wiederholen; Eingabe nicht löschen |
| Exportfehler | Fehler an der Aktion, Ergebnis erhalten; erneuter Versuch möglich |

Die abgebildete E-LRC → Lyricsfile-Konvertierung ist verlustfrei hinsichtlich
vorhandener Anfänge. Deshalb zeigt der Blueprint eine positive Information und
keine unpassende Verlustwarnung. Reverse-Export-Warnungen sind eigene Zustände.

## Barrierefreiheit und Bedienung

- Sichtbare Labels; Platzhalter ersetzen keine Beschriftung.
- Alle Funktionen per Tastatur; Tab-Reihenfolge folgt der Lesereihenfolge.
- `Ctrl/Cmd+O`: Öffnen, `Ctrl/Cmd+Enter`: aktuelle Konvertierung unmittelbar
  anstoßen. Standard-Textbearbeitung im Editor bleibt erhalten.
- Keine globale Abfanglogik für normale Zeichen- oder Pfeiltasten.
- Vorschau-Slider mit zugänglichem Zeitwert, Start/Pause mit eindeutigem Label.
- Diagnosezusammenfassung als zurückhaltende Live-Region; nicht jede Eingabe
  wird vorgelesen. Keine automatische Fokusverschiebung bei Live-Konvertierung.
- Touchziele möglichst mindestens 44 × 44 px; Text zoomfähig bis 200 %.
- Hervorhebung bleibt bei reduzierter Bewegung statisch und verständlich.

## Vorschau-Dateien

- `blueprint/desktop.svg`: Entwurf des vollständigen Arbeitsbereichs.
- `blueprint/mobile.svg`: Entwurf der kompakten Ansicht mit Eingabetab.

SVGs sind bewusst als überprüfbare, editierbare Vektorgrafiken angelegt.
Die Texte und Zahlen sind Beispieldaten, keine zugesicherte Live-Funktion.
