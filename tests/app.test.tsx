// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Result } from "../src/conversion/engine";
const mocks = vi.hoisted(() => ({
  state: {
    phase: "ready" as const,
    pending: false,
    current: false,
    failure: "",
    result: undefined as Result | undefined,
  },
  save: vi.fn(async () => true),
  conversion: vi.fn(),
}));
vi.mock("../src/conversion/useConversion", () => ({
  useConversion: (...args: unknown[]) => {
    mocks.conversion(...args);
    return mocks.state;
  },
}));
vi.mock("../src/platform/files", async () => {
  const original = await vi.importActual("../src/platform/files");
  return { ...original, isDesktop: () => false, saveFile: mocks.save };
});
import App from "../src/App";
beforeEach(() => {
  mocks.state = {
    phase: "ready",
    pending: false,
    current: false,
    failure: "",
    result: undefined,
  };
  mocks.save.mockClear();
  mocks.conversion.mockClear();
  localStorage.clear();
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function valid() {
  mocks.state = {
    ...mocks.state,
    current: true,
    result: {
      id: 1,
      valid: true,
      output: 'version: "1.0"\nmetadata: {title: T, artist: A}\nplain: Hello',
      metadata: { title: "T", artist: "A" },
      document: {
        version: "1.0",
        metadata: { title: "T", artist: "A" },
        plain: "Hello",
      },
      warnings: [],
      errors: [],
      detected: "lrc",
      hasWords: false,
    },
  };
}
it("starts without a logo and blocks empty exports", () => {
  render(<App />);
  expect(
    screen.getByRole("heading", { name: "Lyrics konvertieren." }),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Exportieren" })).toBeDisabled();
  expect(document.querySelector("img")).toBeNull();
  expect(screen.getByRole("textbox", { name: "Ergebnis" })).toHaveAttribute(
    "readonly",
  );
});
it("loads an E-LRC example and accepts explicit metadata overrides", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.selectOptions(screen.getByLabelText("Zum Ausprobieren"), "elrc");
  expect(
    (screen.getByRole("textbox", { name: "Eingabe" }) as HTMLTextAreaElement)
      .value,
  ).toContain("<00:01.200>Hallo");
  await user.type(screen.getByPlaceholderText("Titel ergänzen"), "Neu");
  expect(mocks.conversion.mock.lastCall?.[0].overrides.title).toBe("Neu");
});
it("switches direction using the valid output and restores the prior draft", async () => {
  valid();
  const user = userEvent.setup();
  render(<App />);
  fireEvent.change(screen.getByRole("textbox", { name: "Eingabe" }), {
    target: { value: "Original" },
  });
  await user.click(
    screen.getByRole("button", { name: "Konvertierungsrichtung wechseln" }),
  );
  expect(screen.getByRole("textbox", { name: "Eingabe" })).toHaveValue(
    mocks.state.result!.output,
  );
  expect(screen.getByLabelText("Zielformat")).toHaveValue("lrc");
  await user.click(
    screen.getByRole("button", { name: "Vorherige Eingabe wiederherstellen" }),
  );
  expect(screen.getByRole("textbox", { name: "Eingabe" })).toHaveValue(
    "Original",
  );
});
it("exports exactly the valid output under the derived filename", async () => {
  valid();
  const user = userEvent.setup();
  render(<App />);
  await user.selectOptions(screen.getByLabelText("Zum Ausprobieren"), "lrc");
  await user.click(screen.getByRole("button", { name: "Exportieren" }));
  expect(mocks.save).toHaveBeenCalledWith(
    "abendlicht.lyricsfile.yaml",
    mocks.state.result!.output,
  );
  await waitFor(() =>
    expect(screen.getByText("Datei exportiert.")).toBeInTheDocument(),
  );
});
it("shows concrete data-loss hints", async () => {
  valid();
  mocks.state.result!.warnings = [
    "Word timing omitted in normal LRC; use enhanced=true to retain starts",
  ];
  const user = userEvent.setup();
  render(<App />);
  await user.type(screen.getByRole("textbox", { name: "Eingabe" }), "A");
  expect(
    screen.getByText(/Wortzeiten gehen beim normalen LRC-Export verloren/),
  ).toBeInTheDocument();
});
it("makes tab selection keyboard-accessible", async () => {
  const user = userEvent.setup();
  render(<App />);
  const first = screen.getByRole("tab", { name: "Eingabe" });
  first.focus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: "Ergebnis" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.getByRole("tab", { name: "Ergebnis" })).toHaveFocus();
});
it("persists theme preferences without persisting lyrics", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Darstellung" }),
    "dark",
  );
  await user.type(
    screen.getByRole("textbox", { name: "Eingabe" }),
    "Private lyrics",
  );
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(Object.keys(localStorage)).toEqual(["verso-theme"]);
});
it("opens help with real format and privacy guidance", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Hilfe" }));
  expect(screen.getByRole("dialog")).toHaveAttribute("open");
  expect(
    screen.getByText(/beim Schließen geht unexportierter Text verloren/),
  ).toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Schließen", exact: true }),
  );
  expect(document.querySelector("dialog")).not.toHaveAttribute("open");
});

it("rejects an oversized file before reading its contents", async () => {
  const user = userEvent.setup();
  render(<App />);
  const file = new File(["A"], "large.lrc", { type: "text/plain" });
  Object.defineProperty(file, "size", { value: 2 * 1024 * 1024 + 1 });
  const read = vi.fn();
  Object.defineProperty(file, "arrayBuffer", { value: read });
  await user.upload(screen.getByLabelText("Lyrics-Datei öffnen"), file);
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Datei ist größer als 2 MiB",
  );
  expect(read).not.toHaveBeenCalled();
});
