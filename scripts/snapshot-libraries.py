"""Update reviewable source snapshots; never copy Git metadata, builds or fixtures."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

root = Path(__file__).resolve().parents[1]
manifest = {}
for name in ('lyricsfile', 'lyricsbridge'):
    source = root.parent / name
    if subprocess.check_output(['git', '-C', str(source), 'status', '--porcelain'], text=True).strip():
        raise SystemExit(f'{name}: commit changes before snapshotting')
    commit = subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip()
    target = root / 'vendor' / name
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)
    paths = subprocess.check_output(['git', '-C', str(source), 'ls-files', '-z']).split(b'\0')
    checksums = {}
    for entry in paths:
        if not entry:
            continue
        relative = entry.decode('utf-8')
        content = (source / relative).read_bytes()
        output = target / relative
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(content)
        checksums[relative] = hashlib.sha256(content).hexdigest()
    manifest[name] = {'commit': commit, 'files': checksums}
(root / 'vendor' / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('Versioned source snapshots updated. No compiled assets or fixture files included.')
