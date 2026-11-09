"""Accept only a successful CI run whose application and engine inputs match this checkout."""
import json, os, subprocess
from pathlib import Path
run_id=os.environ['CI_RUN_ID']
if not run_id.isdecimal(): raise SystemExit('ci_run_id must be numeric')
def api(path): return json.loads(subprocess.check_output(['gh','api',path]))
repo=os.environ['GITHUB_REPOSITORY'];run=api(f'repos/{repo}/actions/runs/{run_id}')
if run['status']!='completed' or run['conclusion']!='success' or run['head_branch']!='main':raise SystemExit('A successful main CI run is required')
if run['path']!='.github/workflows/ci.yml':raise SystemExit('Wrong CI workflow')
sha=run['head_sha'];subprocess.run(['git','fetch','--no-tags','origin',sha],check=True)
critical=['src','audio-core','vendor','src-tauri/src','src-tauri/Cargo.toml','src-tauri/Cargo.lock','src-tauri/tauri.conf.json','src-tauri/capabilities','src-tauri/build.rs','src-tauri/icons','package.json','package-lock.json','vite.config.ts','scripts/prepare-engine.mjs','scripts/bootstrap-libraries.py']
subprocess.run(['git','diff','--exit-code',sha,'HEAD','--',*critical],check=True)
version=json.loads(Path('package.json').read_text())['version']
if version!=json.loads(Path('src-tauri/tauri.conf.json').read_text())['version']:raise SystemExit('Version mismatch')
with open(os.environ['GITHUB_OUTPUT'],'a') as out:out.write(f'version={version}\nci_sha={sha}\n')
print(f'Validated release {version}; application inputs match green CI {run_id} ({sha})')
