import { useEffect, useMemo, useRef, useState } from "react";
import { zipSync, strToU8 } from "fflate";
import Editor from "../Editor";
import { useConversion } from "../conversion/useConversion";
import { decodeFile, isDesktop } from "../platform/files";
import {
  AudioEngine,
  AUDIO_LIMIT,
  base64FromBytes,
  bytesFromBase64,
  download,
  type AudioInfo,
  type Patch,
} from "./client";
import AudioPlayer from "./AudioPlayer";
import "./audio.css";
interface Source {
  id: string;
  label: string;
  text: string;
  format: "auto" | "lyricsfile";
  original: string;
}
const common = [
  ["TrackTitle", "Titel"],
  ["TrackArtist", "Interpret"],
  ["AlbumTitle", "Album"],
  ["AlbumArtist", "Album-Interpret"],
  ["TrackNumber", "Track"],
  ["DiscNumber", "Disc"],
  ["RecordingDate", "Datum / Jahr"],
  ["Genre", "Genre"],
] as const;
const lyricKey = (key: string) => /^(Lyrics|UnsyncLyrics)$/.test(key);
export default function AudioWorkspace() {
  const [file, setFile] = useState<File>();
  const [info, setInfo] = useState<AudioInfo>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [covers, setCovers] = useState<Patch["covers"]>([]);
  const [selectedCover, setSelectedCover] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [selected, setSelected] = useState("");
  const [view, setView] = useState("source");
  const [offset, setOffset] = useState<"reject" | "apply" | "ignore">("reject");
  const [review, setReview] = useState(false);
  const [embed, setEmbed] = useState(false);
  const [sideLf, setSideLf] = useState(true);
  const [sideLrc, setSideLrc] = useState(false);
  const [enhanced, setEnhanced] = useState(true);
  const [align, setAlign] = useState(false);
  const modal = useRef<HTMLElement>(null);
  const engine = useRef<AudioEngine | null>(null);
  const openInput = useRef<HTMLInputElement>(null);
  const sideInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const sequence = useRef(0);
  const source = sources.find((s) => s.id === selected);
  const tagValue = (key: string) => {
    const t = info?.tags.find((t) => t.key === key);
    return t ? (fields[t.id] ?? t.text ?? "") : (fields["@" + key] ?? "");
  };
  const overrides = useMemo(
    () =>
      align
        ? {
            title: tagValue("TrackTitle"),
            artist: tagValue("TrackArtist"),
            album: tagValue("AlbumTitle"),
          }
        : {},
    [align, fields, info],
  );
  // Missing identities may be supplied by track tags without rewriting the source draft.
  const identities = useMemo(
    () => ({
      ...(tagValue("TrackTitle") ? { title: tagValue("TrackTitle") } : {}),
      ...(tagValue("TrackArtist") ? { artist: tagValue("TrackArtist") } : {}),
    }),
    [fields, info],
  );
  const request = useMemo(
    () => ({
      source: source?.text ?? "",
      format: source?.format ?? ("auto" as const),
      target: "lyricsfile" as const,
      offset,
      overrides: align
        ? overrides
        : source?.format === "lyricsfile"
          ? {}
          : identities,
    }),
    [source, offset, overrides, identities, align],
  );
  const lf = useConversion(request, 0);
  const lrc = useConversion(
    useMemo(
      () => ({
        ...request,
        target: enhanced ? ("elrc" as const) : ("lrc" as const),
      }),
      [request, enhanced],
    ),
    0,
  );
  const doc = lf.result?.document;
  const plain = doc?.plain ?? doc?.lines?.map((l) => l.text).join("\n") ?? "";
  const visibleCovers = useMemo(() => {
    const originals = (info?.covers ?? []).flatMap((c) => {
      const edit = covers.find((e) => e.id === c.id);
      if (edit && !edit.data) return [];
      return [{ ...c, data: edit?.data ?? c.data }];
    });
    const added = covers
      .filter((c) => !c.id && c.data)
      .map((c, i) => ({
        id: "new:" + i,
        kind: "CoverFront",
        description: "Neues Cover",
        mime:
          bytesFromBase64(c.data!).slice(0, 3).join(",") === "255,216,255"
            ? "image/jpeg"
            : "image/png",
        data: c.data!,
        bytes: bytesFromBase64(c.data!).length,
      }));
    return [...originals, ...added];
  }, [info, covers]);
  const cover =
    visibleCovers.find((c) => c.id === selectedCover) ?? visibleCovers[0];
  const dirty =
    Object.keys(fields).length +
      covers.length +
      sources.filter((s) => s.text !== s.original).length >
    0;
  useEffect(() => () => engine.current?.close(), []);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  useEffect(() => {
    if (!review) return;
    const prior = document.activeElement as HTMLElement;
    const element = modal.current;
    (element?.querySelector("button") as HTMLButtonElement)?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setReview(false);
      if (e.key === "Tab") {
        const buttons = Array.from(
          element?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled)",
          ) ?? [],
        );
        const first = buttons[0],
          last = buttons.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      prior?.focus();
    };
  }, [review, busy]);
  async function open(f: File) {
    if (busy) return;
    if (
      dirty &&
      !window.confirm(
        "Die offenen Entwürfe verwerfen und eine andere Audio-Datei öffnen?",
      )
    )
      return;
    if (f.size > AUDIO_LIMIT) {
      setError("Audio-Dateien sind derzeit auf 64 MiB begrenzt.");
      return;
    }
    if (!/\.(mp3|flac|m4a)$/i.test(f.name)) {
      setError("Bitte MP3, FLAC oder M4A öffnen.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const next = new AudioEngine();
    try {
      const result = await next.open(await f.arrayBuffer());
      engine.current?.close();
      engine.current = next;
      setFile(f);
      setInfo(result);
      setFields({});
      setCovers([]);
      setSelectedCover("");
      setView("source");
      setOffset("reject");
      setEmbed(false);
      setAlign(false);
      const embedded: Source[] = result.tags
        .filter((t) => lyricKey(t.key) && t.text !== null)
        .map((t) => ({
          id: t.id,
          label: `Eingebettet · ${t.key} · ${t.language} ${t.description}`,
          text: t.text!,
          original: t.text!,
          format: "auto" as const,
        }));
      const extras = result.sources.map((s, i) => ({
        id: "embedded:" + i,
        label: s.label,
        text: s.text,
        original: s.text,
        format:
          s.format === "lyricsfile"
            ? ("lyricsfile" as const)
            : ("auto" as const),
      }));
      embedded.push(...extras);
      setSideLf(embedded.length > 0);
      setSideLrc(false);
      const all = embedded.length
        ? embedded
        : [
            {
              id: "draft",
              label: "Neuer Lyrics-Entwurf",
              text: "",
              original: "",
              format: "auto" as const,
            },
          ];
      setSources(all);
      setSelected(all[0].id);
    } catch (e) {
      next.close();
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function sidecar(f: File) {
    try {
      const text = decodeFile(await f.arrayBuffer());
      const id = "side:" + ++sequence.current;
      setSources((s) => [
        ...s,
        {
          id,
          label: `Begleitdatei · ${f.name}`,
          text,
          original: text,
          format: /\.ya?ml$/i.test(f.name) ? "lyricsfile" : "auto",
        },
      ]);
      setSelected(id);
      setView("source");
      setError("");
    } catch (e) {
      setError(String(e));
    }
  }
  async function importCover(f: File) {
    try {
      if (f.size > 8 * 1024 * 1024)
        throw Error("Cover darf höchstens 8 MiB groß sein.");
      const data = new Uint8Array(await f.arrayBuffer());
      const png =
        data[0] === 137 && data[1] === 80 && data[2] === 78 && data[3] === 71;
      const jpeg = data[0] === 255 && data[1] === 216 && data[2] === 255;
      if (!png && !jpeg) throw Error("Bitte ein PNG- oder JPEG-Cover wählen.");
      const bitmap = await createImageBitmap(f);
      const pixels = bitmap.width * bitmap.height;
      bitmap.close();
      if (pixels > 16000000)
        throw Error("Cover darf höchstens 16 Millionen Pixel haben.");
      const b64 = base64FromBytes(data);
      const replace = coverInput.current?.dataset.replace === "true";
      setCovers((previous) => {
        if (replace && cover) {
          if (cover.id.startsWith("new:")) {
            const index = Number(cover.id.slice(4));
            let n = -1;
            return previous.map((p) =>
              !p.id && ++n === index ? { data: b64 } : p,
            );
          }
          return [
            ...previous.filter((p) => p.id !== cover.id),
            { id: cover.id, data: b64 },
          ];
        }
        return [...previous, { data: b64 }];
      });
      setError("");
    } catch (e) {
      setError(String(e));
    }
  }
  function removeCover() {
    if (!cover) return;
    setCovers((previous) => {
      if (cover.id.startsWith("new:")) {
        const index = Number(cover.id.slice(4));
        let n = -1;
        return previous.filter((p) => p.id || ++n !== index);
      }
      return [...previous.filter((p) => p.id !== cover.id), { id: cover.id }];
    });
    setSelectedCover("");
  }
  function updateSource(text: string) {
    setSources((s) => s.map((x) => (x.id === selected ? { ...x, text } : x)));
  }
  const viewText =
    view === "source"
      ? (source?.text ?? "")
      : view === "plain"
        ? plain
        : view === "lyricsfile"
          ? (lf.result?.output ?? "")
          : (lrc.result?.output ?? "");
  const canExport = lf.current && !!doc;
  async function save() {
    if (!file || !engine.current || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const patch: Patch = {
        fields: Object.entries(fields).map(([id, value]) => ({ id, value })),
        covers,
      };
      if (embed) {
        if (!canExport) throw Error("Bitte zuerst die Lyrics prüfen.");
        patch.plain = plain;
      }
      if ((sideLf && !lf.current) || (sideLrc && !lrc.current))
        throw Error("Bitte zuerst die Lyrics-Konvertierung abschließen.");
      const result = await engine.current.save(patch);
      const stem = file.name.replace(/\.[^.]+$/, "") + ".verso";
      const audioName = stem + file.name.slice(file.name.lastIndexOf("."));
      const outputs: Record<string, Uint8Array<ArrayBuffer>> = {
        [audioName]: new Uint8Array(result),
      };
      if (sideLf)
        outputs[stem + ".lyricsfile.yaml"] = strToU8(lf.result!.output);
      if (sideLrc) outputs[stem + ".lrc"] = strToU8(lrc.result!.output);
      if (isDesktop()) {
        const { invoke } = await import("@tauri-apps/api/core");
        const archive = Object.keys(outputs).length > 1;
        const name = archive ? stem + ".zip" : audioName;
        const bytes = archive
          ? zipSync(outputs, { level: 0 })
          : outputs[audioName];
        const saved = await invoke<boolean>("save_audio_file", {
          name,
          data: base64FromBytes(bytes),
        });
        if (!saved) {
          setNotice("Speichern abgebrochen; die Quelldatei bleibt erhalten.");
          return;
        }
      } else if (Object.keys(outputs).length > 1)
        download(
          stem + ".zip",
          new Blob([zipSync(outputs, { level: 0 })], {
            type: "application/zip",
          }),
        );
      else
        download(
          audioName,
          new Blob([result], { type: file.type || "application/octet-stream" }),
        );
      setNotice(
        "Export erstellt. Audio-Hash und Tags wurden geprüft. Die Quelldatei wurde nicht verändert.",
      );
      setReview(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main
      className="audio-workspace"
      id="audio-workspace"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files.length === 1)
          void open(e.dataTransfer.files[0]);
        else setError("Bitte genau eine Audio-Datei öffnen.");
      }}
    >
      <div className="intro">
        <div>
          <p className="eyebrow">DEIN TRACK. DEINE LYRICS.</p>
          <h1>Alles im Takt.</h1>
          <p>Tags, Cover und Lyrics an einem Ort. Ohne Upload.</p>
        </div>
        <div className="file-actions">
          <button disabled={busy} onClick={() => openInput.current?.click()}>
            Audio öffnen
          </button>
          <button
            className="primary"
            disabled={!file || busy}
            onClick={() => setReview(true)}
          >
            Speichern unter…
          </button>
        </div>
      </div>
      <input
        ref={openInput}
        type="file"
        className="sr-only"
        aria-label="Audio-Datei öffnen"
        accept=".flac,.mp3,.m4a"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void open(f);
          e.target.value = "";
        }}
      />
      <input
        ref={sideInput}
        type="file"
        className="sr-only"
        aria-label="Lyrics-Begleitdatei öffnen"
        accept=".lrc,.yaml,.yml,.txt"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void sidecar(f);
          e.target.value = "";
        }}
      />
      <input
        ref={coverInput}
        type="file"
        className="sr-only"
        aria-label="Cover importieren"
        accept="image/png,image/jpeg"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importCover(f);
          e.target.value = "";
        }}
      />
      {error && (
        <div className="file-error" role="alert">
          {error}
          <button onClick={() => setError("")}>Schließen</button>
        </div>
      )}
      {notice && (
        <p className="audio-notice" role="status">
          {notice}
        </p>
      )}
      {busy && <p role="status">Audio wird verarbeitet…</p>}
      {info?.warnings.map((w, i) => (
        <p className="audio-notice" key={i}>
          {w}
        </p>
      ))}
      {!file ? (
        <section className="audio-empty card">
          <p className="eyebrow">MP3 · FLAC · M4A / AAC</p>
          <h2>Ein Track ist der Anfang.</h2>
          <p>Audio hier ablegen oder eine Datei öffnen.</p>
          <button
            className="primary"
            onClick={() => openInput.current?.click()}
          >
            Audio-Datei auswählen
          </button>
          <p className="subtle">
            Bis 64 MiB · Verarbeitung im Arbeitsspeicher · Original bleibt
            erhalten
          </p>
        </section>
      ) : (
        <>
          <div className="track-summary">
            <strong>{file.name}</strong>
            <span>
              {info?.format} · {(file.size / 1024 / 1024).toFixed(1)} MiB ·{" "}
              {info?.sample_rate ? info.sample_rate + " Hz" : ""} ·{" "}
              {info?.channels} Kanäle
            </span>
            <span>
              {dirty ? "Ungespeicherte Entwürfe" : "Original geöffnet"}
            </span>
          </div>
          <div className="audio-columns">
            <section className="card track-tags" aria-label="Track-Tags">
              <div className="audio-section-heading">
                <div>
                  <p className="eyebrow">TRACK-TAGS</p>
                  <h2>Der Track im Detail.</h2>
                </div>
              </div>
              <div className="cover-editor">
                <div className="cover-art">
                  {cover?.data ? (
                    <img
                      src={`data:${cover.mime};base64,${cover.data}`}
                      alt={cover.description || cover.kind}
                    />
                  ) : (
                    <span>
                      {cover ? "Vorschau nicht verfügbar" : "Kein Cover"}
                    </span>
                  )}
                </div>
                <div className="cover-controls">
                  <strong>Cover</strong>
                  <span className="subtle">
                    {visibleCovers.length} Bildeinträge
                  </span>
                  <label className="sr-only" htmlFor="cover-select">
                    Bildeintrag
                  </label>
                  <select
                    id="cover-select"
                    value={cover?.id ?? ""}
                    onChange={(e) => setSelectedCover(e.target.value)}
                  >
                    <option value="" disabled>
                      Kein Bild
                    </option>
                    {visibleCovers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.kind}
                        {c.description ? " · " + c.description : ""}
                      </option>
                    ))}
                  </select>
                  <div className="cover-buttons">
                    <button
                      onClick={() => {
                        if (coverInput.current)
                          coverInput.current.dataset.replace = "false";
                        coverInput.current?.click();
                      }}
                    >
                      Hinzufügen
                    </button>
                    <button
                      disabled={!cover}
                      onClick={() => {
                        if (coverInput.current)
                          coverInput.current.dataset.replace = "true";
                        coverInput.current?.click();
                      }}
                    >
                      Ersetzen
                    </button>
                    <button
                      disabled={!cover?.data}
                      onClick={() =>
                        cover?.data &&
                        download(
                          "cover." +
                            (cover.mime === "image/png" ? "png" : "jpg"),
                          new Blob([bytesFromBase64(cover.data)], {
                            type: cover.mime,
                          }),
                        )
                      }
                    >
                      Bild exportieren
                    </button>
                    <button disabled={!cover} onClick={removeCover}>
                      Entfernen
                    </button>
                  </div>
                </div>
              </div>
              <div className="track-fields">
                {common.map(([key, label]) => {
                  const tag = info?.tags.find((t) => t.key === key);
                  return (
                    <label key={key}>
                      {label}
                      <input
                        aria-label={"Track " + label}
                        value={tagValue(key)}
                        onChange={(e) =>
                          setFields((p) => ({
                            ...p,
                            [tag?.id ?? "@" + key]: e.target.value,
                          }))
                        }
                      />
                    </label>
                  );
                })}
              </div>
              <details className="advanced-tags">
                <summary>Weitere Tags · alle lesbaren Einträge</summary>
                <p className="subtle">
                  Gleichnamige Einträge bleiben getrennt. Unbekannte und binäre
                  Felder werden unverändert erhalten.
                </p>
                {info?.tags
                  .filter(
                    (t) =>
                      !common.some(([key]) => key === t.key) &&
                      !lyricKey(t.key),
                  )
                  .map((t) => (
                    <label key={t.id}>
                      {t.key}{" "}
                      <small>
                        {t.language} {t.description}
                      </small>
                      <input
                        aria-label={"Tag " + t.id}
                        disabled={t.text === null}
                        value={
                          fields[t.id] ??
                          t.text ??
                          "Binärer Inhalt (schreibgeschützt)"
                        }
                        onChange={(e) =>
                          setFields((p) => ({ ...p, [t.id]: e.target.value }))
                        }
                      />
                    </label>
                  ))}
              </details>
              <p className="subtle">
                Cover: PNG / JPEG · bis 8 MiB und 16 MP. Ersetzen und Entfernen
                betrifft nur den ausgewählten Bildeintrag.
              </p>
            </section>
            <section className="card audio-lyrics" aria-label="Audio-Lyrics">
              <div className="audio-section-heading">
                <div>
                  <p className="eyebrow">LYRICS</p>
                  <h2>Die passende Quelle.</h2>
                </div>
                <button onClick={() => sideInput.current?.click()}>
                  Begleitdatei öffnen
                </button>
              </div>
              <label className="source-select">
                Lyrics-Quelle
                <select
                  aria-label="Lyrics-Quelle"
                  value={selected}
                  onChange={(e) => {
                    setSelected(e.target.value);
                    setView("source");
                    setOffset("reject");
                  }}
                >
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                      {s.text !== s.original ? " · bearbeitet" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div className="audio-views" aria-label="Lyrics-Ansicht">
                {[
                  ["source", "Entwurf"],
                  ["plain", "Plain"],
                  ["lrc", "LRC / E-LRC"],
                  ["lyricsfile", "Lyricsfile"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    aria-pressed={view === id}
                    onClick={() => setView(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Editor
                label="Audio-Lyrics-Text"
                filename={source?.label ?? "Lyrics"}
                value={viewText}
                onChange={updateSource}
                readOnly={view !== "source"}
                placeholder="Lyrics einfügen oder eine Begleitdatei öffnen…"
              />
              {view !== "source" && (
                <p className="subtle">
                  Konvertierte Ansicht.{" "}
                  <button
                    disabled={!canExport}
                    onClick={() => {
                      const id = "draft:" + ++sequence.current;
                      setSources((s) => [
                        ...s,
                        {
                          id,
                          label: "Neuer Entwurf · " + view,
                          text: viewText,
                          original: viewText,
                          format: view === "lyricsfile" ? "lyricsfile" : "auto",
                        },
                      ]);
                      setSelected(id);
                      setView("source");
                    }}
                  >
                    Als eigenen Entwurf übernehmen
                  </button>
                </p>
              )}
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={align}
                  onChange={(e) => setAlign(e.target.checked)}
                />{" "}
                Lyrics-Metadaten an Track-Tags angleichen
              </label>
              {source?.text.includes("[offset:") && (
                <label>
                  LRC-Offset
                  <select
                    aria-label="Audio LRC-Offset"
                    value={offset}
                    onChange={(e) => setOffset(e.target.value as typeof offset)}
                  >
                    <option value="reject">Bewusst auswählen…</option>
                    <option value="apply">Anwenden</option>
                    <option value="ignore">Ignorieren</option>
                  </select>
                </label>
              )}
              <div className="audio-diagnostics" role="status">
                {lf.pending
                  ? "Lyrics werden aktualisiert…"
                  : lf.failure ||
                    lf.result?.errors.join(" · ") ||
                    (canExport
                      ? `${doc?.lines?.length ?? 0} Zeilen · ${lf.result?.hasWords ? "Wortzeiten" : "ohne Wortzeiten"}`
                      : "Noch keine Lyrics")}
                {lf.result?.warnings.map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
              </div>
            </section>
          </div>
          <AudioPlayer file={file} doc={doc} stale={lf.pending} />
          <footer>
            <span>Original bleibt erhalten · Audio ohne Neukodierung</span>
            <span>Bis 64 MiB · Codec-Wiedergabe abhängig vom System</span>
          </footer>
        </>
      )}
      {review && (
        <div className="audio-modal-backdrop">
          <section
            ref={modal}
            className="audio-save-dialog card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-title"
          >
            <div className="audio-section-heading">
              <div>
                <p className="eyebrow">EXPORT PRÜFEN</p>
                <h2 id="save-title">Eine neue Version speichern.</h2>
              </div>
              <button disabled={busy} onClick={() => setReview(false)}>
                Schließen
              </button>
            </div>
            <p>
              Neue Audio-Kopie mit <strong>.verso</strong> im Namen. Mehrere
              Dateien werden zusammen als ZIP gespeichert. Das Original bleibt
              erhalten.
            </p>
            {error && (
              <p className="file-error" role="alert">
                {error}
              </p>
            )}
            <div className="save-changes">
              <strong>Änderungen</strong>
              {Object.entries(fields).map(([id, value]) => (
                <p key={id}>
                  {info?.tags.find((t) => t.id === id)?.key ?? id.slice(1)}:{" "}
                  {info?.tags.find((t) => t.id === id)?.text || "leer"} →{" "}
                  {value || "leer"}
                </p>
              ))}
              <p>
                Cover: {info?.covers.length ?? 0} → {visibleCovers.length} ·{" "}
                {covers.length} Bildänderungen
              </p>
            </div>
            <label className="check-row">
              <input
                type="checkbox"
                checked={embed}
                disabled={!canExport}
                onChange={(e) => setEmbed(e.target.checked)}
              />{" "}
              Plain-Lyrics aus dem ausgewählten Entwurf einbetten
            </label>
            <p className="subtle">
              Ersetzt das Standard-Plain-Lyrics-Feld der primären Tags. Ersetzt
              nur den ersten passenden Eintrag; weitere Sprachen und
              Beschreibungen bleiben erhalten. Vorhandenes SYLT bleibt erhalten.
            </p>
            <label className="check-row">
              <input
                type="checkbox"
                checked={sideLf}
                disabled={!canExport}
                onChange={(e) => setSideLf(e.target.checked)}
              />{" "}
              Lyricsfile als Begleitdatei
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={sideLrc}
                disabled={!canExport}
                onChange={(e) => setSideLrc(e.target.checked)}
              />{" "}
              LRC als Begleitdatei
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={enhanced}
                onChange={(e) => setEnhanced(e.target.checked)}
              />{" "}
              Vorhandene Wortzeiten als E-LRC erhalten
            </label>
            {sideLrc &&
              lrc.result?.warnings.map((w, i) => (
                <p className="audio-notice" key={i}>
                  {w}
                </p>
              ))}
            <p className="subtle">
              Lyricsfile hat kein standardisiertes Audio-Tag und wird als
              Sidecar gespeichert. Beim Export werden Audio-Hash und
              geschriebene Tags erneut geprüft.
            </p>
            <button
              className="primary"
              disabled={
                busy ||
                (sideLf && !lf.current) ||
                (sideLrc && !lrc.current) ||
                (embed && !canExport)
              }
              onClick={() => void save()}
            >
              {busy ? "Wird geprüft…" : "Geprüfte Kopie exportieren"}
            </button>
            <button
              disabled={busy}
              onClick={() => {
                setSideLf(false);
                setSideLrc(false);
                setEmbed(false);
              }}
            >
              Nur Audio-Tags speichern
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
