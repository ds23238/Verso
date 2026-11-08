/// <reference lib="webworker" />
import { convert, type Request } from "./engine";
let loading:
  | Promise<[typeof import("lyricsbridge"), typeof import("lyricsfile")]>
  | undefined;
self.onmessage = async (event: MessageEvent) => {
  if (event.data.type === "init") {
    const base = event.data.base as string;
    loading = Promise.all([
      import(
        /* @vite-ignore */ new URL("engine/lyricsbridge/web/index.js", base)
          .href
      ),
      import(
        /* @vite-ignore */ new URL("engine/lyricsfile/web/index.js", base).href
      ),
    ]).then(async ([lb, lf]) => {
      await Promise.all([lb.init(), lf.init()]);
      return [lb, lf];
    });
    loading
      .then(() => self.postMessage({ type: "ready" }))
      .catch((error) =>
        self.postMessage({ type: "failure", message: String(error) }),
      );
    return;
  }
  if (event.data.type === "convert") {
    const request = event.data.request as Request;
    try {
      if (!loading) throw new Error("Konverter ist noch nicht initialisiert.");
      const [lb, lf] = await loading;
      self.postMessage({ type: "result", result: convert(request, lb, lf) });
    } catch (error) {
      self.postMessage({ type: "failure", message: String(error) });
    }
  }
};
