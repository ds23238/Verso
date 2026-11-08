import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const cwd = fileURLToPath(new URL('..', import.meta.url));
const {name} = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const packed = JSON.parse(execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm',
  ['pack', '--dry-run', '--json', '--ignore-scripts'], {cwd, encoding: 'utf8'}))[0];
const files = new Set(packed.files.map(file => file.path));
for (const path of ['index.js', 'index.d.ts', 'types.d.ts', 'shared/api.js', 'web/index.js',
  'web/index.d.ts', `web/wasm/${name}.js`, `web/wasm/${name}_bg.wasm`]) {
  assert(files.has(path), `Missing package asset: ${path}`);
}
assert(![...files].some(path => path.startsWith('test/')), 'Tests should not be shipped');
console.log(`PASS: ${name} npm package includes WASM, loaders and types (${packed.size} bytes packed)`);
