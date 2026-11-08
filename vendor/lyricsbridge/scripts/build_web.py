"""Build the browser binding. Requires Rust wasm target and matching wasm-bindgen CLI."""
from pathlib import Path
import re
import subprocess

root = Path(__file__).resolve().parents[1]
lock = (root / 'Cargo.lock').read_text()
version = re.search(r'\[\[package\]\]\nname = "wasm-bindgen"\nversion = "([^"]+)"', lock).group(1)
actual = subprocess.check_output(['wasm-bindgen', '--version'], text=True).strip().split()[-1]
if actual != version:
    raise SystemExit(f'wasm-bindgen CLI {version} required, got {actual}. Install matching release.')
target = root / 'target/wasm'
subprocess.run(['cargo', 'build', '--locked', '--release', '--target',
    'wasm32-unknown-unknown', '--features', 'wasm', '--target-dir', str(target)], cwd=root, check=True)
output = root / 'bindings/node/web/wasm'
output.mkdir(parents=True, exist_ok=True)
subprocess.run(['wasm-bindgen', str(target / 'wasm32-unknown-unknown/release/lyricsbridge.wasm'),
    '--target', 'web', '--out-dir', str(output), '--out-name', 'lyricsbridge'], check=True)
print(output)
