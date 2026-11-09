export interface Tag {
  id: string;
  key: string;
  text: string | null;
  language: string;
  description: string;
}
export interface Cover {
  id: string;
  kind: string;
  description: string;
  mime: string;
  data: string | null;
  bytes: number;
}
export interface AudioInfo {
  sources: { label: string; text: string; format: string }[];
  format: string;
  duration_ms: number;
  sample_rate: number | null;
  channels: number | null;
  tags: Tag[];
  covers: Cover[];
  payload_sha256: string;
  warnings: string[];
}
export interface Patch {
  fields: { id: string; value: string | null }[];
  covers: { id?: string; data?: string }[];
  plain?: string;
  lyricsfile?: string;
}
export const AUDIO_LIMIT = 64 * 1024 * 1024;
export class AudioEngine {
  private worker: Worker;
  private sequence = 0;
  private pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  constructor() {
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.onmessage = ({ data }) => {
      const p = this.pending.get(data.id);
      if (!p) return;
      this.pending.delete(data.id);
      if (data.error) p.reject(new Error(data.error));
      else p.resolve(data.result);
    };
    this.worker.onerror = () => {
      for (const p of this.pending.values())
        p.reject(new Error("Audio-Engine konnte nicht geladen werden."));
      this.pending.clear();
    };
  }
  private call<T>(
    type: string,
    value: unknown,
    transfer: Transferable[] = [],
  ): Promise<T> {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      this.worker.postMessage(
        {
          id,
          type,
          value,
          base: new URL(import.meta.env.BASE_URL, document.baseURI).href,
        },
        transfer,
      );
    });
  }
  open(bytes: ArrayBuffer) {
    return this.call<AudioInfo>("open", bytes, [bytes]);
  }
  save(patch: Patch) {
    return this.call<ArrayBuffer>("save", patch);
  }
  close() {
    this.worker.terminate();
    for (const p of this.pending.values())
      p.reject(new Error("Audio-Datei geschlossen."));
    this.pending.clear();
  }
}
export function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function bytesFromBase64(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}
export function base64FromBytes(bytes: Uint8Array) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192)
    text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}
