import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { convert, exportName, type Request } from "../src/conversion/engine";
import { duration, displayEnd, active } from "../src/Preview";
import { LatestQueue } from "../src/conversion/queue";
import { decodeFile, MAX_BYTES } from "../src/platform/files";
const require = createRequire(import.meta.url);
const native = (name: string) => {
  const addon = require(resolve(`../${name}/build/${name}.node`));
  return (op: string, payload: object) => {
    const result = JSON.parse(
      addon.request(JSON.stringify({ op, ...payload })),
    );
    if (!result.ok) throw new Error(result.error);
    return result.value;
  };
};
const lbCall = native("lyricsbridge"),
  lfCall = native("lyricsfile");
const bridge = {
  fromLrc: (source: string, options: object) =>
    lbCall("from_lrc", { source, options }),
  toLrc: (source: object, options: { enhanced: boolean }) =>
    lbCall("to_lrc", { document: source, ...options }),
} as unknown as typeof import("lyricsbridge");
const lyrics = {
  parse: (source: string) => lfCall("parse", { source }),
  stringify: (document: object) => lfCall("stringify", { document }),
  validate: (document: object) => lfCall("validate", { document }),
} as unknown as typeof import("lyricsfile");
const request = (source: string, extra: Partial<Request> = {}): Request => ({
  id: 1,
  source,
  format: "auto",
  target: "lyricsfile",
  offset: "reject",
  overrides: {},
  ...extra,
});
const fixture = (name: string) =>
  readFileSync(
    resolve(process.env.LYRICS_TEST_INPUTS ?? "../work/test-inputs", name),
    "utf8",
  );
describe("UI conversion adapter using the actual Rust libraries", () => {
  it("converts all external files in the planned directions", () => {
    for (const name of [
      "normal.lrc",
      "enhanced.lrc",
      "example.lyricsfile.yaml",
    ]) {
      const result = convert(
        request(fixture(name), {
          target: name.endsWith("yaml") ? "elrc" : "lyricsfile",
        }),
        bridge,
        lyrics,
      );
      expect(result.valid).toBe(true);
      expect(result.output).toBeTruthy();
    }
  });
  it("exposes partial metadata when title or artist is missing, but never exports", () => {
    const result = convert(request("[ti:Existing]\n[00:01]Hi"), bridge, lyrics);
    expect(result.metadata?.title).toBe("Existing");
    expect(result.errors.join()).toContain("Interpret fehlt");
    expect(result.output).toBe("");
    expect(result.valid).toBe(false);
  });
  it("fills identities explicitly and preserves album overrides", () => {
    const result = convert(
      request("[00:01]Hi", {
        overrides: { title: "T", artist: "A", album: "X" },
      }),
      bridge,
      lyrics,
    );
    expect(result.valid).toBe(true);
    expect(result.document?.metadata.album).toBe("X");
  });
  it("rejects an explicitly cleared identity", () => {
    const result = convert(
      request(fixture("normal.lrc"), { overrides: { title: "" } }),
      bridge,
      lyrics,
    );
    expect(result.valid).toBe(false);
    expect(result.output).toBe("");
  });
  it("requires an explicit offset and moves only existing timing", () => {
    const source = "[offset:200]\n[ti:T]\n[ar:A]\n[00:01]<00:01.100>Hi";
    expect(convert(request(source), bridge, lyrics).valid).toBe(false);
    const applied = convert(
      request(source, { offset: "apply" }),
      bridge,
      lyrics,
    );
    expect(applied.document?.lines?.[0].start_ms).toBe(1200);
    expect(applied.document?.lines?.[0].words?.[0].start_ms).toBe(1300);
    expect(applied.document?.lines?.[0].end_ms).toBeUndefined();
  });
  it("warns about actual information loss on reverse export", () => {
    const result = convert(
      request(fixture("example.lyricsfile.yaml"), { target: "lrc" }),
      bridge,
      lyrics,
    );
    expect(result.warnings.join()).toContain("Word timing");
    expect(result.warnings.join()).toContain("end times");
  });
  it("says when enhanced export has no word markers to preserve", () => {
    expect(
      convert(
        request(fixture("normal.lrc"), { target: "elrc" }),
        bridge,
        lyrics,
      ).warnings.join(),
    ).toContain("Keine Wortzeiten");
  });
  it("keeps invalid syntax from producing exportable stale output", () => {
    expect(
      convert(
        request("[00:99]Bad", { overrides: { title: "T", artist: "A" } }),
        bridge,
        lyrics,
      ).valid,
    ).toBe(false);
  });
});
describe("latest-only scheduling", () => {
  it("runs first and latest without accumulating old revisions", () => {
    const sent: number[] = [];
    const queue = new LatestQueue<{ id: number }>((message) =>
      sent.push(message.id),
    );
    queue.submit({ id: 1 });
    queue.submit({ id: 2 });
    queue.submit({ id: 3 });
    expect(sent).toEqual([1]);
    queue.complete();
    expect(sent).toEqual([1, 3]);
    queue.complete();
    queue.submit({ id: 4 });
    expect(sent).toEqual([1, 3, 4]);
  });
});
describe("file handling", () => {
  it("rejects invalid UTF-8 and oversized data", () => {
    expect(() => decodeFile(new Uint8Array([0xc3, 0x28]).buffer)).toThrow(
      "UTF-8",
    );
    expect(() => decodeFile(new ArrayBuffer(MAX_BYTES + 1))).toThrow("2 MiB");
  });
  it("decodes BOM and Unicode", () => {
    expect(decodeFile(new TextEncoder().encode("\ufeff日本語").buffer)).toBe(
      "日本語",
    );
  });
  it("derives portable, non-overwriting names", () => {
    expect(exportName("song.lyricsfile.yaml", "elrc")).toBe("song.lrc");
    expect(exportName("a:b.lrc", "lyricsfile")).toBe("a_b.lyricsfile.yaml");
  });
});
describe("display timing never mutates source data", () => {
  it("retains equal starts and explicit overlaps", () => {
    const lines = [
      { text: "A", start_ms: 1000, end_ms: 4000 },
      { text: "B", start_ms: 1000 },
      { text: "C", start_ms: 2500 },
    ];
    expect(
      lines.filter((line) => active(line, lines, 2000, 5000)),
    ).toHaveLength(2);
    expect(displayEnd(lines[1], lines, 5000)).toBe(2500);
    expect(lines[1]).not.toHaveProperty("end_ms");
  });
  it("gives a display horizon without adding end times", () => {
    const doc = {
      version: "1.0" as const,
      metadata: { title: "T", artist: "A" },
      lines: [{ text: "A", start_ms: 1000 }],
    };
    expect(duration(doc)).toBe(3500);
    expect(doc.lines[0]).not.toHaveProperty("end_ms");
  });
});
