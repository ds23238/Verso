export const samples = {
  lrc: {
    name: "abendlicht.lrc",
    text: "[ti:Abendlicht]\n[ar:Beispielband]\n[al:Proben]\n[length:00:15.000]\n[00:01.200]Hallo Welt\n[00:05.000][00:09.500]Noch einmal\n",
  },
  elrc: {
    name: "abendlicht.lrc",
    text: "[ti:Abendlicht]\n[ar:Beispielband]\n[length:00:15.000]\n[00:01.200]<00:01.200>Hallo <00:01.800>Welt\n[00:05.000]<00:05.000>Noch <00:05.600>einmal\n",
  },
  lyricsfile: {
    name: "abendlicht.lyricsfile.yaml",
    text: 'version: "1.0"\nmetadata:\n  title: Abendlicht\n  artist: Beispielband\n  duration_ms: 15000\nlines:\n  - text: Hallo Welt\n    start_ms: 1200\n    end_ms: 2500\n    words:\n      - text: "Hallo "\n        start_ms: 1200\n      - text: Welt\n        start_ms: 1800\n  - text: Noch einmal\n    start_ms: 5000\nplain: |-\n  Hallo Welt\n  Noch einmal\n',
  },
};
