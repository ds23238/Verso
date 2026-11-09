import { useEffect, useMemo, useRef, useState } from "react";
import type { Document } from "lyricsfile";
import { active, timeLabel } from "../Preview";
export default function AudioPlayer({
  file,
  doc,
  stale,
}: {
  file: File;
  doc?: Document;
  stale: boolean;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState("");
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState("1");
  const [volume, setVolume] = useState(0.8);
  const [span, setSpan] = useState(30);
  const [follow, setFollow] = useState(true);
  const [windowStart, setWindowStart] = useState(0);
  const [wave, setWave] = useState<number[]>([]);
  const [waveBusy, setWaveBusy] = useState(false);
  const [message, setMessage] = useState("");
  const generation = useRef(0);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    setTime(0);
    setDuration(0);
    setWave([]);
    setMessage("");
    const g = ++generation.current;
    return () => {
      if (g === generation.current) generation.current++;
      URL.revokeObjectURL(u);
    };
  }, [file]);
  const lines = useMemo(
    () => [...(doc?.lines ?? [])].sort((a, b) => a.start_ms - b.start_ms),
    [doc],
  );
  const current = lines.findIndex((line) =>
    active(line, lines, time * 1000, duration * 1000),
  );
  const shown =
    current >= 0 ? current : lines.findIndex((l) => l.start_ms > time * 1000);
  const start = follow
    ? Math.max(0, Math.min(Math.max(0, duration - span), time - span / 3))
    : windowStart;
  function seek(t: number) {
    if (audio.current) {
      audio.current.currentTime = Math.max(0, Math.min(duration, t));
      setTime(audio.current.currentTime);
    }
  }
  async function play() {
    try {
      if (audio.current?.paused) await audio.current.play();
      else audio.current?.pause();
    } catch {
      setMessage(
        "Die Audio-Wiedergabe wird von diesem Browser nicht unterstützt. Tags können weiterhin bearbeitet werden.",
      );
    }
  }
  async function waveform() {
    const g = generation.current;
    setWaveBusy(true);
    const context = new AudioContext();
    try {
      const buffer = await context.decodeAudioData(await file.arrayBuffer());
      if (g !== generation.current) return;
      const count = 900;
      const bins = new Array<number>(count).fill(0);
      const step = Math.max(1, Math.floor(buffer.length / count));
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = 0; i < count; i++) {
          let peak = 0;
          for (
            let j = i * step;
            j < Math.min(data.length, (i + 1) * step);
            j += Math.max(1, Math.floor(step / 100))
          )
            peak = Math.max(peak, Math.abs(data[j]));
          bins[i] = Math.max(bins[i], peak);
        }
      }
      setWave(bins);
    } catch {
      if (g === generation.current)
        setMessage(
          "Keine Wellenform verfügbar. Die Wiedergabe bleibt unabhängig davon nutzbar.",
        );
    } finally {
      await context.close();
      if (g === generation.current) setWaveBusy(false);
    }
  }
  return (
    <section className="audio-preview card" aria-label="Audio-Timing-Vorschau">
      <div className="audio-section-heading">
        <div>
          <p className="eyebrow">TIMING-VORSCHAU</p>
          <h2>Hören. Lesen. Abgleichen.</h2>
        </div>
        <span className="subtle">Echte Audiozeit · keine Zeiten erfunden</span>
      </div>
      <audio
        ref={audio}
        src={url}
        preload="metadata"
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) =>
          setDuration(
            Number.isFinite(e.currentTarget.duration)
              ? e.currentTarget.duration
              : 0,
          )
        }
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() =>
          setMessage(
            "Dieses Audioformat lässt sich hier nicht wiedergeben. Die Tag-Bearbeitung bleibt verfügbar.",
          )
        }
      />
      <div
        className={`lyric-stage ${stale ? "is-stale" : ""}`}
        aria-label="Aktuelle Lyrics"
      >
        <p className="neighbor">{shown > 0 ? lines[shown - 1]?.text : " "}</p>
        <div className="current-lyric">
          {stale
            ? "Lyrics werden aktualisiert…"
            : current < 0
              ? "♪"
              : lines[current].words?.length
                ? lines[current].words!.map((w, i) => (
                    <span
                      key={i}
                      className={
                        active(
                          w,
                          lines[current].words!,
                          time * 1000,
                          duration * 1000,
                        )
                          ? "word-active"
                          : ""
                      }
                    >
                      {w.text}
                    </span>
                  ))
                : lines[current].text}
        </div>
        <p className="neighbor">
          {lines[shown + 1]?.text ??
            (lines.length
              ? " "
              : "Öffne Lyrics oder eine Begleitdatei für die synchrone Vorschau.")}
        </p>
      </div>
      <div className="transport">
        <button
          aria-label="Fünf Sekunden zurück"
          onClick={() => seek(time - 5)}
        >
          −5 s
        </button>
        <button
          className="primary play-button"
          disabled={!duration}
          onClick={() => void play()}
        >
          {playing ? "Pause" : "Abspielen"}
        </button>
        <button aria-label="Fünf Sekunden vor" onClick={() => seek(time + 5)}>
          +5 s
        </button>
        <output>
          {timeLabel(time * 1000)} <span>/ {timeLabel(duration * 1000)}</span>
        </output>
        <label>
          Tempo
          <select
            aria-label="Wiedergabetempo"
            value={speed}
            onChange={(e) => {
              setSpeed(e.target.value);
              if (audio.current)
                audio.current.playbackRate = Number(e.target.value);
            }}
          >
            {["0.5", "0.75", "1", "1.25", "1.5", "2"].map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
        <label>
          Lautstärke
          <input
            aria-label="Lautstärke"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => {
              setVolume(Number(e.target.value));
              if (audio.current) audio.current.volume = Number(e.target.value);
            }}
          />
        </label>
      </div>
      <input
        className="audio-seek"
        aria-label="Audioposition"
        type="range"
        min="0"
        max={duration || 1}
        step="0.01"
        value={time}
        onChange={(e) => seek(Number(e.target.value))}
      />
      <div className="timeline-settings">
        <label>
          <input
            type="checkbox"
            checked={follow}
            onChange={(e) => {
              setFollow(e.target.checked);
              setWindowStart(start);
            }}
          />{" "}
          Abspielposition folgen
        </label>
        <label>
          Zeitausschnitt
          <select
            aria-label="Zeitausschnitt"
            value={span}
            onChange={(e) => setSpan(Number(e.target.value))}
          >
            {[10, 30, 60, 120].map((n) => (
              <option key={n} value={n}>
                {n} s
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={waveBusy || duration > 600 || !duration}
          title="Optional; bis 10 Minuten. Audio wird nur für die Anzeige dekodiert."
          onClick={() => void waveform()}
        >
          {waveBusy
            ? "Wellenform wird berechnet…"
            : wave.length
              ? "Wellenform neu berechnen"
              : "Wellenform anzeigen"}
        </button>
      </div>
      <div className="audio-timeline" aria-label="Zeitleiste">
        <svg
          viewBox="0 0 900 110"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <line x1="0" y1="55" x2="900" y2="55" className="wave-base" />
          {wave.map((peak, i) => {
            const sec = (i / wave.length) * duration;
            const x = ((sec - start) / span) * 900;
            return x >= 0 && x <= 900 ? (
              <line
                key={i}
                x1={x}
                x2={x}
                y1={55 - peak * 40}
                y2={55 + peak * 40}
                className="wave-bar"
              />
            ) : null;
          })}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <text key={i} x={i * 175 + 2} y="105">
              {timeLabel((start + (i * span) / 5) * 1000).slice(0, 5)}
            </text>
          ))}
          <line
            x1={((time - start) / span) * 900}
            x2={((time - start) / span) * 900}
            y1="0"
            y2="88"
            className="playhead"
          />
        </svg>
        <div className="cue-list">
          {!stale &&
            lines
              .filter(
                (l) =>
                  l.start_ms / 1000 >= start &&
                  l.start_ms / 1000 <= start + span,
              )
              .map((l, i) => (
                <button
                  key={i}
                  onClick={() => seek(l.start_ms / 1000)}
                  title={l.text}
                >
                  {timeLabel(l.start_ms)} · {l.text}
                </button>
              ))}
        </div>
      </div>
      {!follow && (
        <input
          aria-label="Zeitleiste verschieben"
          type="range"
          min="0"
          max={Math.max(0, duration - span)}
          value={windowStart}
          onChange={(e) => setWindowStart(Number(e.target.value))}
        />
      )}
      {message && (
        <p className="audio-notice" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
