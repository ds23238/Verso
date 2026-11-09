/** Run in GitHub Actions: real Chromium, production assets, no external services. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { chromium } from "playwright-core";
const root = resolve("dist");
const server = createServer(async (req, res) => {
  try {
    const path = resolve(
      root,
      "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
    );
    if (path !== root && !path.startsWith(root + sep))
      throw Error("Invalid path");
    const file = path === root ? resolve(root, "index.html") : path;
    const bytes = await readFile(file);
    res
      .writeHead(200, {
        "Content-Type": file.endsWith(".wasm")
          ? "application/wasm"
          : file.endsWith(".js")
            ? "text/javascript"
            : file.endsWith(".css")
              ? "text/css"
              : file.endsWith(".html")
                ? "text/html"
                : "application/octet-stream",
      })
      .end(bytes);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
await mkdir("artifacts", { recursive: true });
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    acceptDownloads: true,
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  const errors = [];
  const external = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  context.on("request", (request) => {
    if (
      !request.url().startsWith(origin + "/") &&
      !request.url().startsWith("blob:" + origin + "/")
    )
      external.push(request.url());
  });
  const ready = () =>
    page.waitForFunction(
      () =>
        document.querySelector(".status-row [role=status]")?.textContent ===
        "Konvertierung bereit",
    );
  await page.goto(origin);
  await page.getByLabel("Zum Ausprobieren").selectOption("elrc");
  await ready();
  assert(
    (
      await page
        .getByRole("textbox", { name: "Ergebnis", exact: true })
        .inputValue()
    ).includes("words:"),
  );
  for (const label of ["Eingabe", "Ergebnis"]) {
    const editor = page.getByRole("textbox", { name: label, exact: true });
    await editor.focus();
    assert.equal(
      await editor.evaluate(
        (element) => getComputedStyle(element).outlineStyle,
      ),
      "none",
    );
  }
  await page.getByRole("textbox", { name: "Eingabe", exact: true }).focus();
  await page.screenshot({ path: "artifacts/editor-focus.png", fullPage: true });

  assert.equal(await page.locator("img").count(), 0);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({ path: "artifacts/desktop.png", fullPage: true });
  await page
    .getByRole("textbox", { name: "Eingabe", exact: true })
    .fill("[ti:T]\n[ar:A]\n[00:99]Bad");
  await page.waitForFunction(
    () =>
      document.querySelector(".status-row [role=status]")?.textContent ===
      "Eingabe prüfen",
  );
  assert(
    await page
      .getByRole("button", { name: "Exportieren", exact: true })
      .isDisabled(),
  );
  await page.getByLabel("Zum Ausprobieren").selectOption("elrc");
  await ready();
  await page.getByPlaceholder("Titel ergänzen").fill("Geprüfter Titel");
  await ready();
  const output = await page
    .getByRole("textbox", { name: "Ergebnis", exact: true })
    .inputValue();
  assert(output.includes("Geprüfter Titel"));
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportieren", exact: true }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "abendlicht.lyricsfile.yaml");
  assert.equal(await readFile(await download.path(), "utf8"), output);
  await page.getByRole("button", { name: "Kopieren", exact: true }).click();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    output,
  );
  await page.getByLabel("Zum Ausprobieren").selectOption("lyricsfile");
  await page.waitForFunction(() =>
    document
      .querySelector(".diagnostics")
      ?.textContent.includes(
        "Wortzeiten gehen beim normalen LRC-Export verloren",
      ),
  );
  await page.getByLabel("Zielformat").selectOption("elrc");
  await page.waitForFunction(() =>
    document
      .querySelector("textarea[aria-label=Ergebnis]")
      ?.value.includes("<00:01.200>Hallo"),
  );
  const before = await page
    .getByRole("textbox", { name: "Ergebnis", exact: true })
    .inputValue();
  await page
    .getByRole("slider", { name: "Vorschauzeit" })
    .evaluate((element) => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      ).set.call(element, "1600");
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
  assert.equal(
    await page.locator(".word-active").first().textContent(),
    "Hallo ",
  );
  assert.equal(
    await page
      .getByRole("textbox", { name: "Ergebnis", exact: true })
      .inputValue(),
    before,
  );
  await page
    .getByRole("combobox", { name: "Darstellung" })
    .selectOption("dark");
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await page.screenshot({ path: "artifacts/dark.png", fullPage: true });
  await page
    .getByRole("combobox", { name: "Darstellung" })
    .selectOption("light");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "Ergebnis", exact: true }).click();
  assert(
    await page
      .getByRole("textbox", { name: "Ergebnis", exact: true })
      .isVisible(),
  );
  assert(
    !(await page
      .getByRole("textbox", { name: "Eingabe", exact: true })
      .isVisible()),
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({ path: "artifacts/mobile.png", fullPage: true });
  await page.getByRole("tab", { name: "Eingabe", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page
    .getByLabel("Lyrics-Datei öffnen", { exact: true })
    .setInputFiles(resolve(process.env.LYRICS_TEST_INPUTS, "normal.lrc"));
  await ready();
  assert.equal(
    await page.getByPlaceholder("Titel ergänzen").inputValue(),
    "Abendlicht",
  );
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.items.add(
      new File(["[ti:Drag]\n[ar:CI]\n[00:01.200]Drop"], "drop.lrc", {
        type: "text/plain",
      }),
    );
    document.querySelector(".app-shell").dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: data,
      }),
    );
  });
  await ready();
  assert.equal(
    await page.getByPlaceholder("Titel ergänzen").inputValue(),
    "Drag",
  );
  // Audio V2: real WASM metadata round trips, covers, sidecars, transport and responsive UI.
  await page.getByRole("button", { name: "Audio-Datei", exact: true }).click();
  const fixtureRoot = resolve("../work/audio-fixtures");
  page.on("dialog", (dialog) => dialog.accept());
  for (const ext of ["mp3", "flac", "m4a"]) {
    await page
      .getByLabel("Audio-Datei öffnen", { exact: true })
      .setInputFiles(resolve(fixtureRoot, "track." + ext));
    await page.waitForFunction(() =>
      document
        .querySelector(".track-summary")
        ?.textContent.includes("Original geöffnet"),
    );
    await page.waitForFunction(() =>
      document
        .querySelector(".audio-diagnostics")
        ?.textContent.includes("Zeilen"),
    );
    assert.equal(
      await page.getByLabel("Track Titel", { exact: true }).inputValue(),
      "Abendlicht",
    );
    const originalHash = await page.evaluate(async (ext) => {
      const m = await import("/engine/audio/audio.js");
      await m.default();
      return ext;
    }, ext);
    assert.equal(originalHash, ext);
    await page
      .getByLabel("Track Titel", { exact: true })
      .fill("Audio CI " + ext);
    await page
      .getByLabel("Lyrics-Begleitdatei öffnen", { exact: true })
      .setInputFiles(resolve(fixtureRoot, "track.lrc"));
    await page.waitForFunction(() =>
      document
        .querySelector(".audio-diagnostics")
        ?.textContent.includes("Wortzeiten"),
    );
    await page
      .getByLabel("Cover importieren", { exact: true })
      .setInputFiles(resolve(fixtureRoot, "cover.png"));
    await page.waitForFunction(() =>
      document
        .querySelector(".cover-controls")
        ?.textContent.includes("1 Bildeinträge"),
    );
    await page
      .getByLabel("Cover importieren", { exact: true })
      .setInputFiles(resolve(fixtureRoot, "cover.png"));
    await page.waitForFunction(() =>
      document
        .querySelector(".cover-controls")
        ?.textContent.includes("2 Bildeinträge"),
    );
    await page.getByRole("button", { name: "Entfernen", exact: true }).click();
    await page.waitForFunction(() =>
      document
        .querySelector(".cover-controls")
        ?.textContent.includes("1 Bildeinträge"),
    );
    await page
      .getByRole("button", { name: "Speichern unter…", exact: true })
      .click();
    await page
      .getByRole("button", { name: "LRC + Lyricsfile einbetten", exact: true })
      .click();
    const tagMode = ext === "flac" ? "elrc" : ext === "m4a" ? "plain" : "lrc";
    await page
      .getByLabel("Format im Lyrics-Tag", { exact: true })
      .selectOption(tagMode);
    await page.screenshot({
      path: "artifacts/audio-export-" + ext + ".png",
      fullPage: false,
    });

    if (ext === "mp3") {
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(
        await page
          .locator(".audio-save-dialog")
          .evaluate((el) => el.scrollWidth > el.clientWidth),
        false,
      );
      await page.screenshot({ path: "artifacts/audio-export-mobile.png" });
      await page.setViewportSize({ width: 1440, height: 1100 });
    }
    await page
      .getByRole("checkbox", {
        name: "Lyrics ins Standardfeld einbetten",
      })
      .check();
    await page
      .getByRole("checkbox", { name: "Lyricsfile als Begleitdatei" })
      .check();
    await page
      .getByRole("checkbox", { name: "LRC als Begleitdatei", exact: true })
      .check();
    const downloading = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Geprüfte Kopie exportieren" })
      .click();
    const exported = await downloading;
    assert.equal(exported.suggestedFilename(), "track.verso.zip");
    const files = unzipSync(await readFile(await exported.path()));
    assert(strFromU8(files["track.verso.lyricsfile.yaml"]).includes("words:"));
    assert(strFromU8(files["track.verso.lrc"]).includes("<00:00.500>"));
    const inspected = await page.evaluate(
      async (bytes) => {
        const m = await import("/engine/audio/audio.js");
        await m.default();
        return JSON.parse(m.inspect(Uint8Array.from(bytes)));
      },
      Array.from(files["track.verso." + ext]),
    );
    assert(
      inspected.tags.some(
        (t) => t.key === "TrackTitle" && t.text === "Audio CI " + ext,
      ),
    );
    assert.equal(inspected.covers.length, 1);
    const stored = inspected.tags.find((t) => /Lyrics$/.test(t.key))?.text;
    assert(stored?.includes("Hallo"));
    if (tagMode === "plain") assert(!stored.includes("[00:00.500]"));
    else {
      assert(stored.includes("[00:00.500]"));
      assert.equal(stored.includes("<00:00.500>"), tagMode === "elrc");
    }
    const full = inspected.sources.find((s) => s.label.includes("LYRICSFILE"));
    assert(full?.text.includes("words:"));
    assert(!full.label.includes("com.verso"));
    if (ext === "m4a") assert(full.label.startsWith("com.apple.iTunes:"));
    if (ext === "mp3") {
      await page
        .getByRole("button", { name: "Abspielen", exact: true })
        .click();
      await page.waitForFunction(
        () => document.querySelector("audio")?.currentTime > 0.15,
      );
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page
        .getByRole("slider", { name: "Audioposition", exact: true })
        .fill("0.7");
      await page.waitForFunction(
        () =>
          document.querySelector(".current-lyric .word-active")?.textContent ===
          "Hallo ",
      );
      await page
        .getByRole("button", { name: "Wellenform anzeigen", exact: true })
        .click();
      await page.waitForFunction(
        () => document.querySelectorAll(".wave-bar").length > 0,
      );
      await page.screenshot({
        path: "artifacts/audio-desktop.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({
        path: "artifacts/audio-mobile.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 1440, height: 1100 });
    }
    // Reopen dual-tag exports and do a normal tag-only save: both lyrics fields must survive.
    await page.getByLabel("Audio-Datei öffnen", { exact: true }).setInputFiles({
      name: "dual." + ext,
      mimeType: "application/octet-stream",
      buffer: Buffer.from(files["track.verso." + ext]),
    });
    await page.waitForFunction(() =>
      document.querySelector(".track-summary")?.textContent.includes("dual."),
    );
    await page
      .getByLabel("Lyrics-Quelle", { exact: true })
      .selectOption("embedded:0");
    await page.waitForFunction(() =>
      document
        .querySelector(".audio-diagnostics")
        ?.textContent.includes("Wortzeiten"),
    );
    assert(
      (
        await page
          .getByRole("textbox", { name: "Audio-Lyrics-Text", exact: true })
          .inputValue()
      ).includes("words:"),
    );
    await page
      .getByLabel("Track Titel", { exact: true })
      .fill("Zweiter Durchlauf");
    await page
      .getByRole("button", { name: "Speichern unter…", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Nur Track-Tags", exact: true })
      .click();
    const secondDownload = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Geprüfte Kopie exportieren" })
      .click();
    const second = await secondDownload;
    const secondInfo = await page.evaluate(
      async (bytes) => {
        const m = await import("/engine/audio/audio.js");
        await m.default();
        return JSON.parse(m.inspect(Uint8Array.from(bytes)));
      },
      Array.from(await readFile(await second.path())),
    );
    assert(
      secondInfo.sources.some(
        (s) => s.label.includes("LYRICSFILE") && s.text === full.text,
      ),
    );
    assert(secondInfo.tags.some((t) => t.text === stored));
  }
  // Failed imports leave the previous file and drafts intact.
  await page.getByLabel("Audio-Datei öffnen", { exact: true }).setInputFiles({
    name: "broken.mp3",
    mimeType: "audio/mpeg",
    buffer: Buffer.from("broken"),
  });
  await page.waitForFunction(() =>
    document.querySelector(".audio-workspace [role=alert]"),
  );
  assert(
    (await page.locator(".track-summary").textContent()).includes("dual.m4a"),
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  await writeFile(
    "artifacts/browser-report.json",
    JSON.stringify(
      {
        status: "passed",
        screenshots: ["desktop.png", "dark.png", "mobile.png"],
        externalRequests: external,
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
  await context.close();
  console.log(
    "PASS: real Chromium UI, worker, metadata, invalid input, download, clipboard, preview, dark/mobile, file import and drag/drop.",
  );
} catch (error) {
  await writeFile("artifacts/browser-error.txt", String(error));
  throw error;
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
