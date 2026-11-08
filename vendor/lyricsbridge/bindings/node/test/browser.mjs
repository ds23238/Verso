/** Real-browser integration tests; fixture contents stay outside the repositories. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, writeFile} from 'node:fs/promises';
import {resolve, dirname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';

const bridgeRoot = fileURLToPath(new URL('../../..', import.meta.url));
const parent = dirname(bridgeRoot);
const fixtures = resolve(process.env.LYRICS_TEST_INPUTS ?? `${parent}/work/test-inputs`);
const fixtureNames = ['normal.lrc', 'enhanced.lrc', 'example.lyricsfile.yaml'];
const reference = JSON.parse(await readFile(resolve(fixtures, '../results-rust.json'), 'utf8'));
const workerSource = `
import {init, fromLrc} from '/lyricsbridge/web/index.js';
try {
  await init();
  const result = fromLrc('[00:01.200]Worker', {title: 'Worker', artist: 'Test'});
  postMessage({start: result.document.lines[0].start_ms});
} catch (error) { postMessage({error: String(error)}); }
`;
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/') {
      response.writeHead(200, {'Content-Type': 'text/html'}).end('<!doctype html><title>WASM library tests</title>');
      return;
    }
    if (url.pathname === '/worker.js') {
      response.writeHead(200, {'Content-Type': 'text/javascript'}).end(workerSource);
      return;
    }
    let path;
    if (url.pathname.startsWith('/fixtures/')) {
      const name = url.pathname.slice('/fixtures/'.length);
      if (!fixtureNames.includes(name)) throw new Error('Unknown fixture');
      path = resolve(fixtures, name);
    } else {
      const match = /^\/(lyricsfile|lyricsbridge)\/(.*)$/.exec(url.pathname);
      if (!match) throw new Error('Unknown route');
      const root = resolve(parent, match[1], 'bindings/node');
      path = resolve(root, decodeURIComponent(match[2]));
      if (!path.startsWith(root + sep)) throw new Error('Invalid path');
    }
    const type = path.endsWith('.wasm') ? 'application/wasm' : path.endsWith('.js') ? 'text/javascript' : 'text/plain; charset=utf-8';
    const data = await readFile(path);
    response.writeHead(200, {'Content-Type': type}).end(data);
  } catch {
    response.writeHead(404).end('Not found');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  const externalRequests = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  context.on('request', request => {
    if (!request.url().startsWith(origin + '/')) externalRequests.push(request.url());
  });
  await page.goto(origin);
  const results = await page.evaluate(async () => {
    const check = (ok, message) => { if (!ok) throw new Error(message); };
    const expectError = (action, contains) => {
      try { action(); } catch (error) {
        check(String(error).includes(contains), `Wrong error: ${error}`); return;
      }
      throw new Error('Expected an error');
    };
    const lf = await import('/lyricsfile/web/index.js');
    const lb = await import('/lyricsbridge/web/index.js');
    expectError(() => lf.parse(''), 'init()');
    expectError(() => lb.fromLrc(''), 'init()');
    let failed = false;
    try { await lf.init('/missing.wasm'); } catch { failed = true; }
    check(failed, 'Invalid asset URL must fail');
    await Promise.all([lf.init(), lf.init(), lb.init(), lb.init()]);
    await lf.init(); await lb.init();
    const outputs = {};
    for (const name of ['normal.lrc', 'enhanced.lrc']) {
      const source = await (await fetch(`/fixtures/${name}`)).text();
      const result = lb.fromLrc(source);
      const enhanced = name === 'enhanced.lrc';
      const exported = lb.toLrc(result.document, {enhanced});
      check(JSON.stringify(lb.fromLrc(exported.output).document.lines) === JSON.stringify(result.document.lines), 'Roundtrip differs');
      outputs[name] = result;
    }
    const source = await (await fetch('/fixtures/example.lyricsfile.yaml')).text();
    const {document} = lf.parse(source);
    check(document.lines[0].words[1].start_ms === 1800, 'Word timing lost');
    check(JSON.stringify(lf.parse(lf.stringify(document)).document) === JSON.stringify(document), 'YAML roundtrip differs');
    check(lf.validate(document).length === 0, 'Unexpected diagnostics');
    for (const enhanced of [false, true]) {
      outputs[enhanced ? 'yaml-enhanced' : 'yaml-normal'] = lb.toLrc(source, {enhanced});
    }
    expectError(() => lf.parse(`${source}\nversion: '1.0'\n`), 'duplicate');
    expectError(() => lb.fromLrc('[00:61]Bad', {title: 'T', artist: 'A'}), 'timestamp');
    expectError(() => lf.parse("version: '1.0'\nmetadata: {title: A, artist: B}\nlines: [{text: A, start_ms: 9007199254740993}]"), 'safely');
    const unicode = lb.fromLrc('[00:01.200]<00:01.200>こんにちは <00:01.800>世界', {title: '日本語', artist: '🌍'});
    check(unicode.document.lines[0].text === 'こんにちは 世界', 'Unicode changed');
    for (let i = 0; i < 100; i++) {
      check(lf.parse(lf.stringify(document)).document.lines[0].start_ms === 1200, 'Repeated call failed');
    }
    const worker = await new Promise((resolve, reject) => {
      const worker = new Worker('/worker.js', {type: 'module'});
      const timer = setTimeout(() => {worker.terminate(); reject(new Error('Worker timed out'));}, 20000);
      worker.onmessage = event => { clearTimeout(timer); worker.terminate(); resolve(event.data); };
      worker.onerror = event => { clearTimeout(timer); worker.terminate(); reject(new Error(event.message)); };
    });
    check(worker.start === 1200, `Worker failed: ${JSON.stringify(worker)}`);
    return outputs;
  });
  assert.deepEqual(results, reference, 'Browser must match the direct Rust API');
  await writeFile(resolve(fixtures, '../results-browser.json'), JSON.stringify(results));
  await context.setOffline(true);
  const offline = await page.evaluate(async () => {
    const lb = await import('/lyricsbridge/web/index.js');
    return lb.fromLrc('[00:02]Offline', {title: 'Local', artist: 'Browser'}).document.lines[0].start_ms;
  });
  assert.equal(offline, 2000);
  assert.deepEqual(externalRequests, []);
  assert.deepEqual(pageErrors, []);
  await context.close();

  // Fresh module instances exercise explicit bytes, Response and custom URL inputs.
  const explicitContext = await browser.newContext();
  const explicitPage = await explicitContext.newPage();
  await explicitPage.goto(origin);
  assert.equal(await explicitPage.evaluate(async () => {
    const lb = await import('/lyricsbridge/web/index.js');
    const lf = await import('/lyricsfile/web/index.js');
    const bytes = await (await fetch('/lyricsbridge/web/wasm/lyricsbridge_bg.wasm')).arrayBuffer();
    await lb.init(bytes);
    await lf.init(new URL('/lyricsfile/web/wasm/lyricsfile_bg.wasm', location.href));
    const yaml = lb.fromLrc('[00:01]Bytes', {title: 'T', artist: 'A'}).yaml;
    return lf.parse(yaml).document.lines[0].text;
  }), 'Bytes');
  await explicitContext.close();

  const responseContext = await browser.newContext();
  const responsePage = await responseContext.newPage();
  await responsePage.goto(origin);
  assert.equal(await responsePage.evaluate(async () => {
    const lf = await import('/lyricsfile/web/index.js');
    await lf.init(await fetch('/lyricsfile/web/wasm/lyricsfile_bg.wasm'));
    return lf.parse("version: '1.0'\nmetadata: {title: A, artist: B}\nplain: Response").document.plain;
  }), 'Response');
  await responseContext.close();
  console.log('PASS: Chromium WASM matches Rust for all fixtures; init/retry, Unicode, errors, worker, offline, custom URL/bytes/Response passed.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
