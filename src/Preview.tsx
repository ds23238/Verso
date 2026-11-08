import { useEffect, useMemo, useState } from "react";
import type { Document, Line, Word } from "lyricsfile";
export function duration(doc: Document) {
  return (doc.lines ?? []).reduce(
    (end, line) => Math.max(end, line.end_ms ?? line.start_ms + 2500),
    Math.max(1000, doc.metadata.duration_ms ?? 0),
  );
}
export function displayEnd<
  T extends { start_ms: number; end_ms?: number | null },
>(item: T, items: T[], fallback: number) {
  return (
    item.end_ms ??
    items.reduce(
      (end, other) =>
        other.start_ms > item.start_ms ? Math.min(end, other.start_ms) : end,
      fallback,
    )
  );
}
export function active(
  item: Line | Word,
  items: (Line | Word)[],
  time: number,
  fallback: number,
) {
  const end = displayEnd(item, items, fallback);
  return (
    item.start_ms <= time &&
    (time < end || (time === end && end === item.start_ms))
  );
}
export function intervals<
  T extends { start_ms: number; end_ms?: number | null },
>(items: T[], fallback: number) {
  const starts = [...new Set(items.map((item) => item.start_ms))].sort(
    (a, b) => a - b,
  );
  const next = new Map(
    starts.map((start, i) => [start, starts[i + 1] ?? fallback]),
  );
  return items.map((item) => ({
    item,
    end: item.end_ms ?? next.get(item.start_ms) ?? fallback,
  }));
}
function visible(start: number, end: number, time: number) {
  return start <= time && (time < end || (start === end && time === start));
}
export function timeLabel(ms: number) {
  return `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(Math.floor(ms) % 1000).padStart(3, "0")}`;
}
export default function Preview({
  doc,
  stale,
}: {
  doc?: Document;
  stale: boolean;
}) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const total = useMemo(() => (doc ? duration(doc) : 1000), [doc]);
  const lines = doc?.lines ?? [];
  useEffect(() => {
    setTime(0);
    setPlaying(false);
  }, [doc]);
  useEffect(() => {
    if (!playing) return;
    const start = performance.now() - time;
    const timer = setInterval(() => {
      const next = Math.min(total, performance.now() - start);
      setTime(next);
      if (next >= total) setPlaying(false);
    }, 40);
    return () => clearInterval(timer);
  }, [playing, total]);
  const schedule = useMemo(
    () =>
      intervals(doc?.lines ?? [], total).map((entry) => ({
        ...entry,
        words: intervals(entry.item.words ?? [], entry.end),
      })),
    [doc, total],
  );
  const current = schedule.filter((entry) =>
    visible(entry.item.start_ms, entry.end, time),
  );
  const upcoming = schedule.reduce<Line | undefined>(
    (next, entry) =>
      entry.item.start_ms > time &&
      (!next || entry.item.start_ms < next.start_ms)
        ? entry.item
        : next,
    undefined,
  );
  return (
    <section className="preview panel" aria-labelledby="preview-title">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">TIMING-VORSCHAU</span>
          <h2 id="preview-title">Lyrics in Bewegung.</h2>
        </div>
        <span className="subtle">
          {stale ? "Letztes Ergebnis" : "Zeitsimulation · ohne Audio"}
        </span>
      </div>
      {!doc ? (
        <div className="preview-empty">
          Konvertiere einen Text, um seine Zeitmarken zu erkunden.
        </div>
      ) : !lines.length ? (
        <div className="plain-preview">
          <pre>{doc.plain || "Instrumental – keine Lyrics vorhanden."}</pre>
          <p className="subtle">Keine synchronisierten Zeitmarken vorhanden.</p>
        </div>
      ) : (
        <>
          <div className="playback">
            <button
              type="button"
              className="play-button"
              aria-label={playing ? "Vorschau pausieren" : "Vorschau abspielen"}
              onClick={() => {
                if (time >= total) setTime(0);
                setPlaying(!playing);
              }}
            >
              {playing ? "Pause" : "Abspielen"}
            </button>
            <output className="time">
              {timeLabel(time)} <span>/ {timeLabel(total)}</span>
            </output>
            <input
              aria-label="Vorschauzeit"
              type="range"
              min="0"
              max={Math.ceil(total)}
              step="10"
              value={Math.min(time, total)}
              onChange={(e) => {
                setPlaying(false);
                setTime(Number(e.target.value));
              }}
              aria-valuetext={timeLabel(time)}
            />
          </div>
          <div className="lyrics-stage" aria-label="Aktuelle Lyrics">
            {current.length ? (
              current.map(({ item: line, words }, i) => (
                <p key={i}>
                  {line.words?.length
                    ? words.map(({ item: word, end }, j) => (
                        <span
                          key={j}
                          className={
                            visible(word.start_ms, end, time)
                              ? "word-active"
                              : ""
                          }
                        >
                          {word.text}
                        </span>
                      ))
                    : line.text || (
                        <span className="subtle">Instrumentale Pause</span>
                      )}
                </p>
              ))
            ) : (
              <p className="upcoming">
                {upcoming?.text ?? "Ende der Vorschau"}
              </p>
            )}
          </div>
          <p className="preview-note">
            Anzeigegrenzen bei fehlenden Endzeiten gelten nur für die Vorschau.
            Exportierte Zeiten bleiben unverändert.
          </p>
        </>
      )}
    </section>
  );
}
