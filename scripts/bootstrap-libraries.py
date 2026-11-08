"""Materialize independent library snapshots beside Verso for a clean checkout."""
import hashlib
import json
from pathlib import Path
import shutil

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'vendor/manifest.json').read_text())
for name, entry in manifest.items():
    source = root / 'vendor' / name
    for path, checksum in entry['files'].items():
        if hashlib.sha256((source / path).read_bytes()).hexdigest() != checksum:
            raise SystemExit(f'Snapshot checksum mismatch: {name}/{path}')
    target = root.parent / name
    if target.exists():
        print(f'Using existing {target}; nothing overwritten')
        continue
    shutil.copytree(source, target)
    print(f'Prepared {name} from source commit {entry["commit"]}')
