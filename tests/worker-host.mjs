// Node harness for the actual emitted Web Worker; no browser or HTTP server.
import { parentPort, workerData } from "node:worker_threads";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, ...rest) => {
  const url =
    input instanceof URL
      ? input
      : new URL(typeof input === "string" ? input : input.url);
  if (url.protocol === "file:")
    return new Response(await readFile(url), {
      headers: { "Content-Type": "application/wasm" },
    });
  return originalFetch(input, ...rest);
};
globalThis.self = { postMessage: (message) => parentPort.postMessage(message) };
await import(pathToFileURL(workerData.path).href);
parentPort.on("message", (data) => self.onmessage({ data }));
