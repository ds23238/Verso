interface Engine {
  default: () => Promise<unknown>;
  inspect: (b: Uint8Array) => string;
  edit: (b: Uint8Array, p: string) => Uint8Array;
}
let loading: Promise<Engine> | undefined;
let original: Uint8Array | undefined;
self.onmessage = async ({ data }) => {
  try {
    loading ??= import(
      /* @vite-ignore */ new URL("engine/audio/audio.js", data.base).href
    ).then(async (m: Engine) => {
      await m.default();
      return m;
    });
    const engine = await loading;
    if (data.type === "open") {
      const bytes = new Uint8Array(data.value);
      const result = JSON.parse(engine.inspect(bytes));
      original = bytes;
      self.postMessage({ id: data.id, result });
    } else if (data.type === "save") {
      if (!original) throw new Error("Keine Audio-Datei geöffnet.");
      const result = engine.edit(original, JSON.stringify(data.value));
      self.postMessage(
        { id: data.id, result: result.buffer },
        { transfer: [result.buffer] },
      );
    }
  } catch (e) {
    self.postMessage({ id: data.id, error: String(e) });
  }
};
