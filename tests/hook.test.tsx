// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useConversion } from "../src/conversion/useConversion";
import type { Request } from "../src/conversion/engine";
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  messages: any[] = [];
  terminated = false;
  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(message: unknown) {
    this.messages.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  emit(data: unknown) {
    this.onmessage?.({ data });
  }
}
const input = (source: string): Omit<Request, "id"> => ({
  source,
  format: "auto",
  target: "lyricsfile",
  overrides: {},
  offset: "reject",
});
const response = (id: number) => ({
  type: "result",
  result: {
    id,
    valid: true,
    output: "YAML",
    warnings: [],
    errors: [],
    detected: "lrc",
    hasWords: false,
  },
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("Worker", FakeWorker);
  FakeWorker.instances = [];
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("disables export immediately on a new revision and ignores an old result", () => {
  const { result, rerender } = renderHook(
    ({ source }) => useConversion(input(source), 0),
    { initialProps: { source: "A" } },
  );
  const worker = FakeWorker.instances[0];
  act(() => worker.emit({ type: "ready" }));
  act(() => vi.advanceTimersByTime(200));
  act(() => worker.emit(response(1)));
  expect(result.current.current).toBe(true);
  rerender({ source: "B" });
  expect(result.current.current).toBe(false);
  expect(result.current.pending).toBe(true);
  act(() => worker.emit(response(1)));
  expect(result.current.current).toBe(false);
  act(() => vi.advanceTimersByTime(200));
  act(() => worker.emit(response(2)));
  expect(result.current.current).toBe(true);
});
it("sends only first and latest waiting revisions and terminates on unmount", () => {
  const { rerender, unmount } = renderHook(
    ({ source }) => useConversion(input(source), 0),
    { initialProps: { source: "A" } },
  );
  const worker = FakeWorker.instances[0];
  act(() => vi.advanceTimersByTime(200));
  rerender({ source: "B" });
  act(() => vi.advanceTimersByTime(200));
  rerender({ source: "C" });
  act(() => vi.advanceTimersByTime(200));
  expect(
    worker.messages
      .filter((message) => message.type === "convert")
      .map((message) => message.request.source),
  ).toEqual(["A"]);
  act(() => worker.emit(response(1)));
  expect(
    worker.messages
      .filter((message) => message.type === "convert")
      .map((message) => message.request.source),
  ).toEqual(["A", "C"]);
  unmount();
  expect(worker.terminated).toBe(true);
});
it("reports a worker load error and recreates it on retry", () => {
  const { result, rerender } = renderHook(
    ({ retry }) => useConversion(input("A"), retry),
    { initialProps: { retry: 0 } },
  );
  act(() =>
    FakeWorker.instances[0].emit({ type: "failure", message: "Load failed" }),
  );
  expect(result.current.phase).toBe("error");
  expect(result.current.current).toBe(false);
  rerender({ retry: 1 });
  expect(FakeWorker.instances[0].terminated).toBe(true);
  expect(FakeWorker.instances).toHaveLength(2);
  expect(result.current.phase).toBe("loading");
});
