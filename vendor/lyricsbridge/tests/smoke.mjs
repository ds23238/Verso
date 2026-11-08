import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import * as api from '../bindings/node/index.js';
const root = process.env.LYRICS_TEST_INPUTS;
const outputs = {};
for (const name of ['normal.lrc', 'enhanced.lrc']) {
  const result = api.fromLrc(readFileSync(`${root}/${name}`, 'utf8'));
  const doc = result.document;
  const enhanced = name === 'enhanced.lrc';
  assert.equal(doc.lines[0].start_ms, 1200);
  assert.equal(Boolean(doc.lines[0].words?.length), enhanced);
  assert.deepEqual(api.fromLrc(api.toLrc(doc, {enhanced}).output).document.lines, doc.lines);
  outputs[name] = result;
}
const source = readFileSync(`${root}/example.lyricsfile.yaml`, 'utf8');
for (const enhanced of [false, true]) {
  const result = api.toLrc(source, {enhanced});
  assert(result.warnings.some(w => w.includes('end times')));
  outputs[enhanced ? 'yaml-enhanced' : 'yaml-normal'] = result;
}
assert.throws(() => api.fromLrc('[00:61]Bad', {title: 'A', artist: 'B'}));
writeFileSync(`${root}/../results-node.json`, JSON.stringify(outputs));
console.log('lyricsbridge Node: all 3 fixtures, both directions and error passed');
