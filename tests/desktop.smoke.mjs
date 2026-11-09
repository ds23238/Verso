/** Native Tauri WebDriver smoke test. Start under Xvfb on Linux. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";
const executable =
  process.env.VERSO_TEST_EXECUTABLE ||
  resolve(
    "src-tauri/target/release",
    process.platform === "win32" ? "verso.exe" : "verso",
  );
const reportRoot = process.env.VERSO_TEST_REPORT_DIR || "artifacts";
mkdirSync(reportRoot, { recursive: true });
const driver = spawn("tauri-driver", ["--port", "4444"], {
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
driver.stdout.on("data", (value) => {
  logs += value;
  appendFileSync(`${reportRoot}/tauri-driver-${process.platform}.log`, value);
});
driver.stderr.on("data", (value) => {
  logs += value;
  appendFileSync(`${reportRoot}/tauri-driver-${process.platform}.log`, value);
});
driver.on("error", (error) => (logs += String(error)));
const origin = "http://127.0.0.1:4444";
let session;
await mkdir(reportRoot, { recursive: true });
async function call(path, body, method = "POST") {
  const response = await fetch(origin + path, {
    method,
    signal: AbortSignal.timeout(45000),
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok || result.value?.error) throw Error(JSON.stringify(result));
  return result.value;
}
async function until(action) {
  const deadline = Date.now() + 90000;
  let last;
  while (Date.now() < deadline) {
    try {
      const value = await action();
      if (value) return value;
    } catch (error) {
      last = error;
    }
    await new Promise((done) => setTimeout(done, 300));
  }
  throw Error(`Native wait timed out: ${last ?? logs}`);
}
const execute = (script, args = []) =>
  call(`/session/${session}/execute/sync`, { script, args });
try {
  await until(async () => {
    try {
      await fetch(origin + "/status");
      return true;
    } catch {
      return false;
    }
  });
  const created = await call("/session", {
    capabilities: {
      alwaysMatch: { "tauri:options": { application: executable } },
    },
  });
  session = created.sessionId;
  assert(session);
  await until(() =>
    execute(
      "return document.querySelector('.status-row [role=status]')?.textContent === 'Bereit für deinen Text'",
    ),
  );
  await execute(
    "const e=document.querySelector('textarea[aria-label=Eingabe]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,arguments[0]);e.dispatchEvent(new Event('input',{bubbles:true}));",
    ["[ti:Native]\n[ar:CI]\n[00:01.200]<00:01.200>Hello <00:01.800>world"],
  );
  await until(() =>
    execute(
      "return document.querySelector('textarea[aria-label=Ergebnis]')?.value.includes('start_ms: 1200') && document.querySelector('.status-row [role=status]')?.textContent === 'Konvertierung bereit'",
    ),
  );
  const output = await execute(
    "return document.querySelector('textarea[aria-label=Ergebnis]').value",
  );
  assert(output.includes("words:"));
  assert(output.includes("Native"));
  assert.equal(
    await execute("return document.querySelectorAll('img').length"),
    0,
  );
  const image = await call(`/session/${session}/screenshot`, undefined, "GET");
  await writeFile(
    `${reportRoot}/native-${process.platform}.png`,
    Buffer.from(image, "base64"),
  );
  console.log("Stage: audio workspace");
  // Exercise the audio worker and cover decoding under the actual native CSP.
  await execute(
    "Array.from(document.querySelectorAll('.workspace-modes button')).find(b=>b.textContent==='Audio-Datei').click();",
  );
  const audioBytes = await readFile(
    resolve("../work/audio-fixtures/track.mp3"),
  );
  await execute(
    "const input=document.querySelector('input[aria-label=\"Audio-Datei öffnen\"]');const dt=new DataTransfer();dt.items.add(new File([Uint8Array.from(atob(arguments[0]),c=>c.charCodeAt(0))],'track.mp3',{type:'audio/mpeg'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));",
    [audioBytes.toString("base64")],
  );
  await until(() =>
    execute(
      "return document.querySelector('.track-summary')?.textContent.includes('track.mp3')",
    ),
  );
  assert.equal(
    await execute(
      "return document.querySelector('input[aria-label=\"Track Titel\"]').value",
    ),
    "Abendlicht",
  );
  if (process.env.VERSO_TEST_PLAYBACK === "true") {
    await execute("window.confirm = () => true;");
    await until(() =>
      execute("return document.querySelector('audio')?.duration > 0"),
    );
    for (const ext of ["mp3", "flac", "m4a"]) {
      console.log("Stage: load audio", ext);
      const oldSource = await execute(
        "return document.querySelector('audio').currentSrc",
      );
      const bytes = await readFile(
        resolve("../work/audio-fixtures/track." + ext),
      );
      await execute(
        "const input=document.querySelector('input[aria-label=\"Audio-Datei öffnen\"]');const dt=new DataTransfer();dt.items.add(new File([Uint8Array.from(atob(arguments[0]),c=>c.charCodeAt(0))],arguments[1]));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));",
        [bytes.toString("base64"), "track." + ext],
      );
      await until(() =>
        execute(
          "return document.querySelector('.track-summary')?.textContent.includes(arguments[0]) && document.querySelector('audio')?.currentSrc !== arguments[1] && document.querySelector('audio')?.duration>0",
          ["track." + ext, oldSource],
        ),
      );
      console.log("Stage: play audio", ext);
      const play = await call(`/session/${session}/element`, {
        using: "css selector",
        value: ".play-button",
      });
      const playId = play["element-6066-11e4-a52e-4f735466cecf"];
      await call(`/session/${session}/element/${playId}/click`, {});
      await until(() =>
        execute(
          "return document.querySelector('audio')?.currentTime>0.15 && !document.querySelector('audio').paused",
        ),
      );
      await execute("document.querySelector('audio').pause();");
    }
  }
  console.log("Stage: cover import");
  const coverBytes = await readFile(
    resolve("../work/audio-fixtures/cover.png"),
  );
  await execute(
    "const input=document.querySelector('input[aria-label=\"Cover importieren\"]');const dt=new DataTransfer();dt.items.add(new File([Uint8Array.from(atob(arguments[0]),c=>c.charCodeAt(0))],'cover.png',{type:'image/png'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));",
    [coverBytes.toString("base64")],
  );
  await until(() =>
    execute(
      "return document.querySelector('.cover-art img')?.naturalWidth===300",
    ),
  );
  const nativeAudioImage = await call(
    `/session/${session}/screenshot`,
    undefined,
    "GET",
  );
  await writeFile(
    `${reportRoot}/native-audio-${process.platform}.png`,
    Buffer.from(nativeAudioImage, "base64"),
  );
  await until(() =>
    execute(
      "return document.querySelector('.audio-diagnostics')?.textContent.includes('Zeilen')",
    ),
  );
  await execute(
    "Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Speichern unter…').click();",
  );
  await until(() =>
    execute("return !!document.querySelector('.audio-save-dialog')"),
  );
  await execute(
    "Array.from(document.querySelectorAll('.audio-save-dialog button')).find(b=>b.textContent==='LRC + Lyricsfile einbetten').click();",
  );
  assert.equal(
    await execute(
      "return document.querySelector('select[aria-label=\"Format im Lyrics-Tag\"]').value",
    ),
    "lrc",
  );
  assert.equal(
    await execute(
      "return Array.from(document.querySelectorAll('.audio-save-dialog input[type=checkbox]')).filter(i=>i.checked).length",
    ),
    2,
  );
  const nativeExportImage = await call(
    `/session/${session}/screenshot`,
    undefined,
    "GET",
  );
  await writeFile(
    `${reportRoot}/native-export-${process.platform}.png`,
    Buffer.from(nativeExportImage, "base64"),
  );
  await execute(
    "Array.from(document.querySelectorAll('.audio-save-dialog button')).find(b=>b.textContent==='Schließen').click();",
  );
  await writeFile(
    `${reportRoot}/native-${process.platform}.json`,
    JSON.stringify(
      {
        status: "passed",
        platform: process.platform,
        checks: [
          "native-start",
          "worker-wasm-under-csp",
          "live-conversion",
          "word-timing",
          "no-logo",
          "audio-worker-under-csp",
          "audio-tags",
          "cover-import",
          "dual-tag-export-settings",
        ],
        nativeDialogs: "not automated",
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: native Tauri starts and converts through its actual WebView/worker/CSP.",
  );
} catch (error) {
  if (session) {
    try {
      const state = await execute(
        "const a=document.querySelector('audio');return {text:document.body.innerText,audio:a?{src:a.currentSrc,time:a.currentTime,duration:a.duration,paused:a.paused,readyState:a.readyState,error:a.error?.message}:null};",
      );
      await writeFile(
        `${reportRoot}/failure-state.json`,
        JSON.stringify(state, null, 2),
      );
    } catch {}
    try {
      const shot = await call(
        `/session/${session}/screenshot`,
        undefined,
        "GET",
      );
      await writeFile(`${reportRoot}/failure.png`, Buffer.from(shot, "base64"));
    } catch {}
  }
  throw error;
} finally {
  if (session)
    await call(`/session/${session}`, undefined, "DELETE").catch(() => {});
  driver.kill();
  await writeFile(`${reportRoot}/tauri-driver-${process.platform}.log`, logs);
}
