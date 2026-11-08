"""Generate disposable CI examples outside the repository; never track input files."""
import os
from pathlib import Path

fixtures = {'enhanced.lrc': '[ti:Abendlicht]\n[ar:Beispielband]\n[00:01.200]<00:01.200>Hallo <00:01.800>Welt\n[00:05.000]<00:05.000>Noch <00:05.600>einmal\n', 'normal.lrc': '[ti:Abendlicht]\n[ar:Beispielband]\n[al:Proben]\n[length:00:15.000]\n[00:01.20]Hallo Welt\n[00:05.000][00:09.500]Noch einmal\n[00:12.000]\n', 'example.lyricsfile.yaml': 'version: "1.0"\nmetadata:\n  title: Abendlicht\n  artist: Beispielband\n  album: Proben\n  duration_ms: 15000\n  language: de\nlines:\n  - text: "Hallo Welt"\n    start_ms: 1200\n    end_ms: 2400\n    words:\n      - text: "Hallo "\n        start_ms: 1200\n        end_ms: 1800\n      - text: "Welt"\n        start_ms: 1800\n        end_ms: 2400\n  - text: "Noch einmal"\n    start_ms: 5000\nplain: |-\n  Hallo Welt\n  Noch einmal\n'}
folder = Path(os.environ.get('LYRICS_TEST_INPUTS', Path(__file__).resolve().parents[2] / 'work/test-inputs'))
folder.mkdir(parents=True, exist_ok=True)
for name, source in fixtures.items():
    (folder / name).write_text(source, encoding='utf-8')
print(folder)
