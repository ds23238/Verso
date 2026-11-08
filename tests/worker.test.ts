import { it, expect } from "vitest";
import { Worker } from "node:worker_threads";
import { once } from "node:events";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
it("loads emitted WASM through the built worker and converts all three external fixtures", async () => {
  const path = resolve(
    "dist/assets",
    readdirSync("dist/assets").find((name) => /^worker-.*\.js$/.test(name))!,
  );
  const worker = new Worker(new URL("./worker-host.mjs", import.meta.url), {
    workerData: { path },
  });
  try {
    worker.postMessage({
      type: "init",
      base: pathToFileURL(resolve("dist") + "/").href,
    });
    expect((await once(worker, "message"))[0]).toEqual({ type: "ready" });
    for (const [id, name] of [
      "normal.lrc",
      "enhanced.lrc",
      "example.lyricsfile.yaml",
    ].entries()) {
      const source = readFileSync(
        resolve(process.env.LYRICS_TEST_INPUTS ?? "../work/test-inputs", name),
        "utf8",
      );
      const response = once(worker, "message");
      worker.postMessage({
        type: "convert",
        request: {
          id,
          source,
          format: "auto",
          target: name.endsWith("yaml") ? "elrc" : "lyricsfile",
          offset: "reject",
          overrides: {},
        },
      });
      const message = (await response)[0];
      expect(message.type).toBe("result");
      expect(message.result.valid).toBe(true);
      expect(message.result.document.lines[0].start_ms).toBe(1200);
    }
  } finally {
    await worker.terminate();
  }
}, 30000);
