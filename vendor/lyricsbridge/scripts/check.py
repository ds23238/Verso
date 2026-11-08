"""Run native and optional TypeScript/browser tests against external fixtures."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
model = root.parent / 'lyricsfile'
parser = argparse.ArgumentParser()
parser.add_argument('--build', action='store_true')
parser.add_argument('--web', action='store_true', help='Also build/test WASM, TypeScript and Chromium')
args = parser.parse_args()
fixtures = Path(os.environ.get('LYRICS_TEST_INPUTS', root.parent / 'work/test-inputs')).resolve()
for name in ('normal.lrc', 'enhanced.lrc', 'example.lyricsfile.yaml'):
    if not (fixtures / name).is_file():
        raise SystemExit(f'Missing external fixture: {fixtures / name}; set LYRICS_TEST_INPUTS')
env = os.environ.copy()
env['LYRICS_TEST_INPUTS'] = str(fixtures)
env.setdefault('DASH__SUPPRESS_ANALYTICS', 'true')
env.setdefault('ANALYZER_STATE_LOCATION_OVERRIDE', str(fixtures.parent/'dart-analyzer-state'))
env.setdefault('npm_config_cache', str(fixtures.parent/'npm-cache'))
env['PYTHONPATH'] = os.pathsep.join([str(model/'bindings/python'), str(root/'bindings/python'), env.get('PYTHONPATH', '')])
suffix = '.dll' if sys.platform == 'win32' else '.dylib' if sys.platform == 'darwin' else '.so'
for repo in (model, root):
    env[f'{repo.name.upper()}_LIBRARY'] = str(repo/'build'/ (('' if sys.platform == 'win32' else 'lib') + repo.name + suffix))

def run(command, cwd=root):
    print('+', ' '.join(map(str, command)), flush=True)
    subprocess.run(list(map(str, command)), cwd=cwd, env=env, check=True)

for repo in (model, root):
    if args.build:
        run([sys.executable, repo/'scripts/build.py'], repo)
        if args.web:
            run([sys.executable, repo/'scripts/build_web.py'], repo)
    run(['cargo', 'test', '--locked'], repo)
    run([sys.executable, repo/'tests/smoke.py'], repo)
    run(['node', repo/'tests/smoke.mjs'], repo)
    run(['dart', 'pub', 'get'], repo/'bindings/dart')
    run(['dart', 'analyze', '--fatal-infos'], repo/'bindings/dart')
    run(['dart', 'run', 'test/smoke.dart'], repo/'bindings/dart')
    if args.web:
        npm = 'npm.cmd' if os.name == 'nt' else 'npm'
        run([npm, 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], repo/'bindings/node')
        run([npm, 'run', 'test:types'], repo/'bindings/node')
        run([npm, 'run', 'test:package'], repo/'bindings/node')
run(['cargo', 'run', '--locked', '--example', 'fixtures'])
reference = json.loads((fixtures.parent/'results-rust.json').read_text())
for language in ('python', 'node', 'dart'):
    actual = json.loads((fixtures.parent/f'results-{language}.json').read_text())
    if actual != reference:
        raise SystemExit(f'{language}: output differs from Rust reference')
if args.web:
    run([npm, 'run', 'test:browser'], root/'bindings/node')
    if json.loads((fixtures.parent/'results-browser.json').read_text()) != reference:
        raise SystemExit('Browser output differs from Rust reference')
print('PASS: all four languages' + (' and browser WASM' if args.web else '') + ' produce identical results for all three fixtures.')
