import { useEffect, useMemo, useRef, useState } from "react";
import Editor from "./Editor";
import AudioWorkspace from "./audio/AudioWorkspace";
import Preview from "./Preview";
import { useConversion } from "./conversion/useConversion";
import {
  explain,
  exportName,
  type SourceFormat,
  type TargetFormat,
} from "./conversion/engine";
import {
  decodeFile,
  MAX_BYTES,
  isDesktop,
  openNative,
  saveFile,
} from "./platform/files";
import { samples } from "./samples";
interface Draft {
  source: string;
  format: SourceFormat;
  target: TargetFormat;
  overrides: { title?: string; artist?: string; album?: string };
  name: string;
}
export default function App() {
  const [mode, setMode] = useState("text");
  const [audioVisited, setAudioVisited] = useState(false);
  const [source, setSource] = useState("");
  const [format, setFormat] = useState<SourceFormat>("auto");
  const [target, setTarget] = useState<TargetFormat>("lyricsfile");
  const [overrides, setOverrides] = useState<Draft["overrides"]>({});
  const [offset, setOffset] = useState<"reject" | "apply" | "ignore">("reject");
  const [name, setName] = useState("Unbenannter Text");
  const [retry, setRetry] = useState(0);
  const [tab, setTab] = useState("input");
  const [toast, setToast] = useState("");
  const [fileError, setFileError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [history, setHistory] = useState<Draft[]>([]);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("verso-theme") || "system";
    } catch {
      return "system";
    }
  });
  const input = useRef<HTMLInputElement>(null);
  const help = useRef<HTMLDialogElement>(null);
  const main = useRef<HTMLElement>(null);
  const request = useMemo(
    () => ({ source, format, target, overrides, offset }),
    [source, format, target, overrides, offset],
  );
  const { result, phase, failure, pending, current } = useConversion(
    request,
    retry,
  );
  const outputName = exportName(name, target);
  const metadata = result?.metadata;
  const errors = result?.errors ?? [];
  const warnings = result?.warnings ?? [];
  const updateField = (field: "title" | "artist" | "album", value: string) =>
    setOverrides((previous) => ({ ...previous, [field]: value }));
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    apply();
    media.addEventListener("change", apply);
    try {
      localStorage.setItem("verso-theme", theme);
    } catch {}
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  function load(text: string, filename: string) {
    setSource(text);
    setName(filename);
    setOverrides({});
    setOffset("reject");
    setFormat(/\.ya?ml$/i.test(filename) ? "lyricsfile" : "auto");
    setTarget(/\.ya?ml$/i.test(filename) ? "lrc" : "lyricsfile");
    setHistory([]);
    setFileError("");
    setTab("input");
  }
  async function read(file: File) {
    try {
      if (file.size > MAX_BYTES) throw new Error("Datei ist größer als 2 MiB.");
      load(decodeFile(await file.arrayBuffer()), file.name);
    } catch (error) {
      setFileError(String(error).replace(/^Error: /, ""));
    }
  }
  async function open() {
    setFileError("");
    if (isDesktop()) {
      try {
        const file = await openNative();
        if (file) load(file.content, file.name);
      } catch (error) {
        setFileError(String(error));
      }
    } else input.current?.click();
  }
  async function save() {
    if (!current || !result) return;
    setSaving(true);
    try {
      if (await saveFile(outputName, result.output))
        setToast("Datei exportiert.");
    } catch (error) {
      setFileError(`Export fehlgeschlagen: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  }
  async function copy() {
    if (!current || !result) return;
    try {
      await navigator.clipboard.writeText(result.output);
      setToast("Ergebnis kopiert.");
    } catch {
      setFileError(
        "Kopieren wurde vom Browser nicht erlaubt. Markiere den Ausgabetext oder exportiere die Datei.",
      );
    }
  }
  function swap() {
    if (!current || !result) return;
    setHistory((previous) => [
      ...previous,
      { source, format, target, overrides, name },
    ]);
    setSource(result.output);
    setName(outputName);
    setFormat(target === "lyricsfile" ? "lyricsfile" : "lrc");
    setTarget(
      result.detected === "lyricsfile"
        ? "lyricsfile"
        : result.hasWords
          ? "elrc"
          : "lrc",
    );
    setOverrides({});
    setOffset("reject");
    setTab("input");
  }
  function back() {
    const previous = history.at(-1);
    if (!previous) return;
    setSource(previous.source);
    setFormat(previous.format);
    setTarget(previous.target);
    setOverrides(previous.overrides);
    setName(previous.name);
    setHistory((values) => values.slice(0, -1));
    setOffset("reject");
  }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        void open();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        setRetry((value) => value + 1);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const needsOffset =
    source.includes("[offset:") ||
    errors.some((error) => error.includes("LRC offset"));
  const status =
    phase === "loading"
      ? "Konverter wird geladen"
      : phase === "error"
        ? "Konverter nicht verfügbar"
        : pending
          ? "Wird aktualisiert"
          : !source.trim()
            ? "Bereit für deinen Text"
            : errors.length
              ? "Eingabe prüfen"
              : warnings.length
                ? `${warnings.length} Hinweis${warnings.length === 1 ? "" : "e"}`
                : "Konvertierung bereit";
  return (
    <>
      <a
        className="skip-link"
        href={mode === "text" ? "#workspace" : "#audio-workspace"}
      >
        Zum Arbeitsbereich
      </a>
      <div
        className="app-shell"
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files")) {
            event.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node))
            setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (event.dataTransfer.files.length !== 1) {
            setFileError("Bitte genau eine Datei öffnen.");
            return;
          }
          if (mode === "text") void read(event.dataTransfer.files[0]);
        }}
      >
        <header>
          <span className="wordmark">verso</span>
          <nav className="workspace-modes" aria-label="Verso Arbeitsmodus">
            <button
              aria-pressed={mode === "text"}
              onClick={() => {
                setMode("text");
                setToast("");
              }}
            >
              Text konvertieren
            </button>
            <button
              aria-pressed={mode === "audio"}
              onClick={() => {
                setMode("audio");
                setToast("");
                setAudioVisited(true);
              }}
            >
              Audio-Datei
            </button>
          </nav>
          <div className="header-right">
            <span className="local-badge">
              <span />
              Lokal auf deinem Gerät
            </span>
            <label className="theme-control">
              <span className="sr-only">Darstellung</span>
              <select
                value={theme}
                onChange={(event) => setTheme(event.target.value)}
                aria-label="Darstellung"
              >
                <option value="system">System</option>
                <option value="light">Hell</option>
                <option value="dark">Dunkel</option>
              </select>
            </label>
            <button className="quiet" onClick={() => help.current?.showModal()}>
              Hilfe
            </button>
          </div>
        </header>
        <main id="workspace" ref={main} hidden={mode !== "text"}>
          <div className="intro">
            <div>
              <p className="eyebrow">DEIN TEXT. DEIN FORMAT.</p>
              <h1>Lyrics konvertieren.</h1>
              <p>
                LRC, E-LRC und Lyricsfile. Ohne Upload, direkt auf deinem Gerät.
              </p>
            </div>
            <div className="sample-control">
              <label htmlFor="sample">Zum Ausprobieren</label>
              <select
                id="sample"
                value=""
                onChange={(event) => {
                  const key = event.target.value as keyof typeof samples;
                  const sample = samples[key];
                  if (sample) load(sample.text, sample.name);
                }}
              >
                <option value="">Beispiel laden…</option>
                <option value="lrc">LRC · Zeilenzeiten</option>
                <option value="elrc">E-LRC · Wortzeiten</option>
                <option value="lyricsfile">Lyricsfile · YAML</option>
              </select>
            </div>
          </div>
          <div className="toolbar">
            <div className="formats">
              <label>
                <span>QUELLE</span>
                <select
                  aria-label="Quellformat"
                  value={format}
                  onChange={(event) =>
                    setFormat(event.target.value as SourceFormat)
                  }
                >
                  <option value="auto">Automatisch</option>
                  <option value="lrc">LRC / E-LRC</option>
                  <option value="lyricsfile">Lyricsfile</option>
                </select>
              </label>
              <button
                className="swap"
                title="Ergebnis als Eingabe übernehmen und Richtung wechseln"
                aria-label="Konvertierungsrichtung wechseln"
                disabled={!current}
                onClick={swap}
              >
                ⇄
              </button>
              <label>
                <span>ZIEL</span>
                <select
                  aria-label="Zielformat"
                  value={target}
                  onChange={(event) =>
                    setTarget(event.target.value as TargetFormat)
                  }
                >
                  <option value="lyricsfile">Lyricsfile</option>
                  <option value="lrc">LRC</option>
                  <option value="elrc">E-LRC</option>
                </select>
              </label>
            </div>
            <div className="file-actions">
              <button onClick={() => void open()}>Datei öffnen</button>
              <button
                className="primary"
                disabled={!current || saving}
                onClick={() => void save()}
              >
                {saving ? "Exportiert…" : "Exportieren"}
              </button>
            </div>
          </div>
          <input
            className="sr-only"
            ref={input}
            type="file"
            accept=".lrc,.yaml,.yml,.txt"
            aria-label="Lyrics-Datei öffnen"
            tabIndex={-1}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void read(file);
              event.target.value = "";
            }}
          />
          <div className="metadata">
            <div className="metadata-title">
              <span className="eyebrow">METADATEN</span>
              {history.length > 0 && (
                <button className="text-button" onClick={back}>
                  Vorherige Eingabe wiederherstellen
                </button>
              )}
            </div>
            <div className="metadata-fields">
              {(["title", "artist", "album"] as const).map((field, index) => (
                <label key={field}>
                  <span>
                    {["Titel", "Interpret", "Album"][index]}
                    {index < 2 && <span className="required"> *</span>}
                    <small>
                      {overrides[field] !== undefined
                        ? "Manuell"
                        : metadata?.[field]
                          ? "Aus Datei"
                          : index < 2
                            ? "Erforderlich"
                            : "Optional"}
                    </small>
                  </span>
                  <input
                    value={overrides[field] ?? metadata?.[field] ?? ""}
                    onChange={(event) => updateField(field, event.target.value)}
                    placeholder={
                      [
                        "Titel ergänzen",
                        "Interpret ergänzen",
                        "Album (optional)",
                      ][index]
                    }
                    aria-invalid={Boolean(
                      source.trim() &&
                      !pending &&
                      errors.some((error) =>
                        field === "title"
                          ? error.startsWith("Titel fehlt")
                          : field === "artist"
                            ? error.startsWith("Interpret fehlt")
                            : false,
                      ),
                    )}
                  />
                </label>
              ))}
            </div>
          </div>
          {needsOffset && (
            <fieldset className="offset">
              <legend>Zeitversatz im LRC</legend>
              <p>Der vorhandene Offset wird nicht automatisch interpretiert.</p>
              <select
                aria-label="LRC-Offset behandeln"
                value={offset}
                onChange={(event) =>
                  setOffset(event.target.value as typeof offset)
                }
              >
                <option value="reject">Bitte bewusst auswählen…</option>
                <option value="apply">
                  Offset auf alle vorhandenen Zeiten addieren
                </option>
                <option value="ignore">Offset ignorieren</option>
              </select>
            </fieldset>
          )}
          <div
            className="mobile-tabs"
            role="tablist"
            aria-label="Arbeitsbereich"
            onKeyDown={(event) => {
              const tabs = ["input", "output", "preview"];
              const index = tabs.indexOf(tab);
              const next =
                event.key === "ArrowRight"
                  ? tabs[(index + 1) % 3]
                  : event.key === "ArrowLeft"
                    ? tabs[(index + 2) % 3]
                    : event.key === "Home"
                      ? tabs[0]
                      : event.key === "End"
                        ? tabs[2]
                        : undefined;
              if (next) {
                event.preventDefault();
                setTab(next);
                document.getElementById(`${next}-tab`)?.focus();
              }
            }}
          >
            {[
              ["input", "Eingabe"],
              ["output", "Ergebnis"],
              ["preview", "Vorschau"],
            ].map(([id, label]) => (
              <button
                key={id}
                role="tab"
                tabIndex={tab === id ? 0 : -1}
                aria-selected={tab === id}
                aria-controls={`${id}-panel`}
                id={`${id}-tab`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="editors" data-active={tab}>
            <div id="input-panel" className="input-pane">
              <Editor
                label="Eingabe"
                filename={name}
                value={source}
                onChange={(value) => {
                  setSource(value);
                  setFileError("");
                }}
                badge={
                  result?.detected === "lyricsfile"
                    ? "Lyricsfile"
                    : result?.hasWords
                      ? "E-LRC"
                      : source
                        ? "LRC"
                        : undefined
                }
                placeholder={
                  "Datei hier ablegen oder Lyrics einfügen…\n\n[ti:Dein Titel]\n[ar:Interpret]\n[00:01.200]Die erste Zeile"
                }
              />
            </div>
            <div id="output-panel" className="output-pane">
              <Editor
                label="Ergebnis"
                filename={outputName}
                value={result?.output ?? ""}
                readOnly
                action={
                  <button
                    className="copy"
                    disabled={!current}
                    onClick={() => void copy()}
                  >
                    Kopieren
                  </button>
                }
                placeholder="Dein konvertierter Text erscheint hier."
              />
            </div>
          </div>
          <section
            className={`diagnostics ${errors.length && !pending ? "has-errors" : warnings.length && !pending ? "has-warnings" : ""}`}
            aria-label="Konvertierungsstatus"
          >
            <div className="status-row">
              <span className="status-dot" />
              <strong role="status" aria-live="polite">
                {status}
              </strong>
              {current && (
                <span className="subtle">
                  {result?.document?.lines?.length ?? 0} Zeilen
                  {result?.hasWords ? " · mit Wortzeiten" : ""}
                </span>
              )}
              {phase === "error" && (
                <button onClick={() => setRetry((value) => value + 1)}>
                  Erneut versuchen
                </button>
              )}
            </div>
            {phase === "error" && <p>{failure}</p>}
            {!pending && source.trim() && (
              <>
                {errors.map((error, i) => (
                  <p className="diagnostic" key={`e${i}`}>
                    <span>Fehler</span>
                    {explain(error)}
                  </p>
                ))}
                {warnings.map((warning, i) => (
                  <p className="diagnostic" key={`w${i}`}>
                    <span>Hinweis</span>
                    {explain(warning)}
                  </p>
                ))}
              </>
            )}
          </section>
          {fileError && (
            <div className="file-error" role="alert">
              <p>{fileError}</p>
              <button
                aria-label="Dateihinweis schließen"
                onClick={() => setFileError("")}
              >
                Schließen
              </button>
            </div>
          )}
          <div id="preview-panel" className="preview-wrap" data-active={tab}>
            <Preview doc={result?.document} stale={pending} />
          </div>
          <footer>
            <span>UTF-8 · Millisekunden · Keine Zeiten erfunden</span>
            <span>Dateien bleiben auf deinem Gerät.</span>
          </footer>
        </main>
        {audioVisited && (
          <div hidden={mode !== "audio"}>
            <AudioWorkspace />
          </div>
        )}
        {dragging && mode === "text" && (
          <div className="drop-overlay" aria-hidden="true">
            <div>
              Datei zum Öffnen ablegen
              <span>LRC, E-LRC oder Lyricsfile · maximal 2 MiB</span>
            </div>
          </div>
        )}
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
        <dialog ref={help} className="help-dialog">
          <div className="help-heading">
            <h2>Ein Formatwechsel. Kein Rätsel.</h2>
            <button onClick={() => help.current?.close()}>Schließen</button>
          </div>
          <p>
            Öffne eine Datei oder füge Lyrics ein. Wähle das Zielformat, prüfe
            Hinweise und exportiere eine neue Datei. Alles wird lokal
            verarbeitet.
          </p>
          <dl>
            <dt>LRC</dt>
            <dd>Übernimmt vorhandene Zeilenanfänge.</dd>
            <dt>E-LRC</dt>
            <dd>
              Erhält zusätzlich vorhandene Wortanfänge. Neue Zeiten werden nicht
              erzeugt.
            </dd>
            <dt>Lyricsfile</dt>
            <dd>
              YAML-Format mit Metadaten, Zeilen, optionalen Wörtern und
              Endzeiten.
            </dd>
          </dl>
          <p>
            Fehlende Titel und Interpreten kannst du oben ergänzen. Ein
            LRC-Offset erfordert deine ausdrückliche Auswahl. Endzeiten und
            manche Metadaten können beim LRC-Export verloren gehen; Verso zeigt
            dies an.
          </p>
          <p>
            Die Vorschau simuliert Zeit ohne Audio. Anzeigehilfen werden nicht
            in Dateien gespeichert. Inhalte bleiben nur im Arbeitsspeicher; beim
            Schließen geht unexportierter Text verloren.
          </p>
          <p>
            <kbd>Ctrl / Cmd + O</kbd> Öffnen · <kbd>Ctrl / Cmd + Enter</kbd> neu
            verarbeiten
          </p>
        </dialog>
      </div>
    </>
  );
}
