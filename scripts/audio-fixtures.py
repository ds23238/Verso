"""Generate small, synthetic audio fixtures outside the repository (requires ffmpeg)."""
from pathlib import Path
import subprocess
root=Path(__file__).resolve().parents[2]/'work'/'audio-fixtures'
root.mkdir(parents=True,exist_ok=True)
for ext,codec in [('mp3','libmp3lame'),('flac','flac'),('m4a','aac')]:
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','lavfi','-i','sine=frequency=440:duration=8','-c:a',codec,'-metadata','title=Abendlicht','-metadata','artist=Verso Test','-metadata','album=Testalbum','-metadata','lyrics=[00:00.500]Hallo Welt\n[00:02.000]Eine zweite Zeile','-metadata','comment=Bleibt erhalten',str(root/('track.'+ext))],check=True)
# JPEG/PNG fixture with deterministic dimensions; artwork belongs to Track-Tags.
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=0x146b59:s=300x300','-frames:v','1',str(root/'cover.png')],check=True)
(root/'track.lrc').write_text('[ti:Abendlicht]\n[ar:Verso Test]\n[00:00.500]<00:00.500>Hallo <00:01.000>Welt\n[00:02.000]Eine zweite Zeile\n',encoding='utf8')
print(root)
