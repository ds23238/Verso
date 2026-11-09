# Verso 0.3.0 – Release-Kandidat (x86-64)

Dieser Stand wird als **unveröffentlichter GitHub-Release-Entwurf** vorbereitet.
Die Veröffentlichung erfolgt erst nach gesonderter Freigabe. Die Pakete sind
nicht signiert. Paketnamen verwenden den bestehenden Projektnamen **Verso**.

## Downloads

| Variante | Datei | Verwendung |
| --- | --- | --- |
| Linux Portable | `verso-0.3.0-linux-x86_64-portable.tar.gz` | Entpacken und `Verso` starten; enthält denselben AppDir samt Laufzeit wie das AppImage |
| Linux AppImage | `Verso-0.3.0-x86_64.AppImage` | Ausführbar machen und direkt starten |
| Debian / Ubuntu | `verso_0.3.0_amd64.deb` | `sudo apt install ./verso_0.3.0_amd64.deb` |
| Flatpak | `verso-0.3.0-x86_64.flatpak` | `flatpak install --user ./verso-0.3.0-x86_64.flatpak` |
| Windows MSI | `Verso-0.3.0-x64.msi` | Installer mit eingebettetem WebView2-Offline-Installer |
| Windows Portable | `Verso-0.3.0-x64-portable.exe` | Direkt starten; benötigt installierte Microsoft WebView2 Runtime |

`SHA256SUMS` prüft die Dateien, `BUILD-MANIFEST.json` dokumentiert Quell-Commit,
zugehörigen grünen CI-Stand, Release-Build-Lauf, Größen und Prüfsummen.
Linux ARM64 und Windows ARM64 sind in diesem Kandidaten nicht enthalten.

## Gebündelte Linux-Laufzeit

AppImage und Portable werden auf Ubuntu 22.04 gebaut. Sie enthalten GTK,
WebKitGTK 4.1, JavaScriptCore, deren durch den Bundler ermittelte Bibliotheken,
WebKit-Hilfsprozesse, GStreamer samt vorhandenen Basis-/Good-/Bad-/Ugly-/libav-
Medienplugins sowie DejaVu-Schriftdateien. Der Build prüft explizit WebKit,
Medien-Grundelemente und FLAC-/MP3-/AAC-Decoder im erzeugten AppDir.

Es bleibt ein Linux-System mit kompatibler glibc (Baseline 2.35), passender
Architektur, Desktop-/Grafiktreibern und Audio-Diensten erforderlich. Kernel,
Grafiktreiber und ein laufender Audio-Server lassen sich nicht sinnvoll durch
beigepackte Dateien ersetzen. Hardware-/Treiberunterschiede bleiben möglich.
Es wird keine uneingeschränkte Kompatibilität mit allen Distributionen behauptet.

Falls FUSE fehlt, lässt sich das AppImage ohne FUSE starten:

```sh
chmod +x Verso-0.3.0-x86_64.AppImage
./Verso-0.3.0-x86_64.AppImage --appimage-extract-and-run
```

Alternativ den Portable-TAR entpacken und den enthaltenen `Verso`-Starter verwenden.
Die Debian-Datei bündelt die Systembibliotheken nicht, sondern nennt GTK-/WebKit-
und GStreamer-Abhängigkeiten für die Paketverwaltung.

## Flatpak

Das Paket verwendet `org.gnome.Platform//49`; die Laufzeit wird bei Bedarf über
Flathub installiert und ist nicht zusätzlich vollständig in die `.flatpak`-Datei
kopiert. Das ist vom eigenständigen AppImage zu unterscheiden. Flatpak selbst
muss vorhanden sein. Start: `flatpak run local.verso.app`.

Die Sandbox erhält Desktop-/Grafik-/Audio-Anbindung und Zugriff auf das eigene
Home-Verzeichnis, damit der native Export temporäre Geschwisterdateien für
atomisches Speichern anlegen kann. Netzwerkzugriff ist nicht freigegeben.
Die bestehende App-ID `local.verso.app` wird beibehalten.

## Windows

Die MSI kann eine fehlende WebView2-Laufzeit offline installieren. Eine bereits
vorhandene passende Laufzeit wird genutzt. Der Benutzer kann die MSI normal oder
über `msiexec` installieren und deinstallieren. Der Upgrade-Code ist festgelegt,
damit spätere Installer dieselbe Anwendung aktualisieren.

Die portable `.exe` installiert nichts, enthält aber keine vollständige WebView2-
Laufzeit in dieser einzelnen Datei. Sie benötigt deshalb eine vorhandene
WebView2 Runtime. Browser-/Theme-Daten können wie bisher im Benutzerprofil liegen.
Es gibt weiterhin kein individuelles Verso-Icon; technische Paketressourcen sind
transparent.

## Funktionsumfang

- LRC/E-LRC und Lyricsfile in beide Richtungen konvertieren.
- FLAC, MP3 und M4A/AAC öffnen; Track-Tags und einzelne Cover bearbeiten.
- Echte Timing-Vorschau mit Audio, Wortmarkierung und optionaler Wellenform.
- LRC im üblichen Lyrics-Feld und vollständiges Lyricsfile parallel einbetten.
- M4A-Konventionsvorschlag: `----:org.lyricsfile:LYRICSFILE`.
- Audio-Kopien ohne Neukodierung prüfen und exportieren; Sidecars optional als ZIP.

Audio ist derzeit auf 64 MiB begrenzt. Es werden keine Zeiten erfunden.
Ältere freie Tag-Felder werden gelesen und erhalten. Das neue Lyricsfile-Feld
ist weiterhin eine vorgeschlagene Konvention, kein verabschiedeter Tag-Standard.

## Prüfung und Herkunft

Der manuell gestartete Workflow **Prepare release packages** verlangt die ID
eines erfolgreichen Haupt-CI-Laufs. Er vergleicht dessen App-/Engine-Quellen mit
dem Release-Checkout und übernimmt ausschließlich dessen geprüfte WASM-Artefakte.
Paketierungsdateien und zusätzliche Pakettests können davon abweichen; beide
Quell-Commits werden im Manifest dokumentiert.

Der Workflow baut sechs Varianten, prüft AppImage-Inhalt und Paketabhängigkeiten,
startet den entpackten Portable und die installierte Debian-Datei über native
WebDriver-Tests und spielt dort synthetisches MP3, FLAC und AAC über eine virtuelle
Audio-Ausgabe ab. Außerdem wird das AppImage auf minimalem Ubuntu 24.04 ohne
installiertes GTK/WebKit gestartet. Windows-Portable und installierte MSI werden
nativ getestet; die MSI wird anschließend wieder deinstalliert. Flatpak wird
gebaut, auf fehlende Bibliotheken/Medienplugins geprüft und mit sichtbarem Fenster
gestartet. Screenshots und Logs werden als Actions-Artefakte abgelegt.

Diese Beschreibung benennt die vorgesehenen Release-Prüfungen. Maßgeblich für
bestehende Nachweise ist der tatsächliche Status des jeweiligen Workflow-Laufs;
ein reines Build-Artefakt gilt nicht als bestandener Lauf. Flatpak-Dialoge,
Dateizugriffe außerhalb des Home-Verzeichnisses sowie beliebige Grafik-/Audio-
Hardware sind nicht vollständig automatisiert geprüft.

Erst wenn alle Paketjobs erfolgreich sind, werden die sechs Dateien samt
Prüfsummen und Manifest auf einen **Draft** hochgeladen. Der Workflow enthält
keinen Veröffentlichungsschritt und verändert keinen bereits veröffentlichten
Release.

## Reproduzieren

Workflow in GitHub Actions wählen, `ci_run_id` auf einen erfolgreichen Lauf
setzen und starten. Die zugrunde liegenden Werkzeuge und Konfigurationen liegen
unter `packaging/` und `scripts/release/`. Die normalen Entwicklungs-Builds bleiben
weiterhin ohne Installer. Der Release-Workflow verwendet gesonderte Tauri-
Konfigurationen mit Medien-Bündelung beziehungsweise WebView2-Offline-Installation.

Quellen für die Paketierungsmechanismen:
[Tauri AppImage](https://v2.tauri.app/distribute/appimage/),
[Tauri Windows Installer](https://v2.tauri.app/distribute/windows-installer/),
[Tauri Flatpak](https://v2.tauri.app/distribute/flatpak/).
