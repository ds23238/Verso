import type * as Bridge from "lyricsbridge";
import type * as Lyrics from "lyricsfile";
export type SourceFormat = "auto" | "lrc" | "lyricsfile";
export type TargetFormat = "lyricsfile" | "lrc" | "elrc";
export interface Request {
  id: number;
  source: string;
  format: SourceFormat;
  target: TargetFormat;
  overrides: { title?: string; artist?: string; album?: string };
  offset: "reject" | "apply" | "ignore";
}
export interface Result {
  id: number;
  valid: boolean;
  output: string;
  document?: Lyrics.Document;
  metadata?: Lyrics.Metadata;
  warnings: string[];
  errors: string[];
  detected: "lrc" | "lyricsfile";
  hasWords: boolean;
}
export function detect(source: string): "lrc" | "lyricsfile" {
  return /^\s*\{/.test(source) || /^(?:version|metadata)\s*:/m.test(source)
    ? "lyricsfile"
    : "lrc";
}
export function convert(
  request: Request,
  lb: typeof Bridge,
  lf: typeof Lyrics,
): Result {
  const detected =
    request.format === "auto" ? detect(request.source) : request.format;
  const base: Result = {
    id: request.id,
    valid: false,
    output: "",
    warnings: [],
    errors: [],
    detected,
    hasWords: false,
  };
  if (!request.source.trim()) return base;
  try {
    let doc: Lyrics.Document;
    if (detected === "lrc") {
      const options: Bridge.ImportOptions = { offset: request.offset };
      if (request.overrides.title !== undefined)
        options.title = request.overrides.title;
      if (request.overrides.artist !== undefined)
        options.artist = request.overrides.artist;
      let imported: Bridge.ImportResult | undefined;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          imported = lb.fromLrc(request.source, options);
          break;
        } catch (error) {
          const message = String(error);
          if (message.includes("Missing title")) {
            options.title = "";
            continue;
          }
          if (message.includes("Missing artist")) {
            options.artist = "";
            continue;
          }
          throw error;
        }
      }
      if (!imported) throw new Error("Metadaten konnten nicht gelesen werden.");
      doc = imported.document;
      base.warnings.push(...imported.warnings);
    } else {
      const parsed = lf.parse(request.source);
      doc = parsed.document;
      base.warnings.push(
        ...parsed.warnings.map((d) => `${d.path}: ${d.message}`),
      );
    }
    doc = { ...doc, metadata: { ...doc.metadata, ...request.overrides } };
    base.document = doc;
    base.metadata = doc.metadata;
    base.hasWords =
      doc.lines?.some((line) => Boolean(line.words?.length)) ?? false;
    if (!doc.metadata.title.trim())
      base.errors.push("Titel fehlt. Bitte in den Metadaten ergänzen.");
    if (!doc.metadata.artist.trim())
      base.errors.push("Interpret fehlt. Bitte in den Metadaten ergänzen.");
    for (const d of lf.validate(doc)) {
      const message = `${d.path}: ${d.message}`;
      (d.severity === "error" ? base.errors : base.warnings).push(message);
    }
    if (base.errors.length) return base;
    if (request.target === "lyricsfile") base.output = lf.stringify(doc);
    else {
      const exported = lb.toLrc(doc, { enhanced: request.target === "elrc" });
      base.output = exported.output;
      base.warnings.push(...exported.warnings);
      if (request.target === "elrc" && !base.hasWords)
        base.warnings.push(
          "Keine Wortzeiten vorhanden. E-LRC enthält hier ausschließlich vorhandene Zeilenzeiten.",
        );
    }
    base.valid = true;
  } catch (error) {
    base.errors.push(error instanceof Error ? error.message : String(error));
  }
  base.warnings = [...new Set(base.warnings)];
  return base;
}
export function exportName(name: string, target: TargetFormat): string {
  const stem =
    name
      .replace(/\.lyricsfile\.ya?ml$|\.ya?ml$|\.lrc$/i, "")
      .replace(/[\\/:*?"<>|\x00-\x1f]/g, "_")
      .replace(/[. ]+$/, "") || "lyrics";
  const safeStem = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:$|\.)/i.test(stem)
    ? `_${stem}`
    : stem;
  return `${safeStem}${target === "lyricsfile" ? ".lyricsfile.yaml" : ".lrc"}`;
}
export function explain(message: string): string {
  if (message.includes("Nonzero LRC offset"))
    return "LRC-Offset erkannt. Wähle unter „Zeitversatz“, ob er angewendet oder ignoriert werden soll.";
  if (message.includes("offset semantics unresolved"))
    return "Lyricsfile enthält einen globalen Zeitversatz mit ungeklärter Bedeutung. Löse offset_ms im Quelldokument auf, bevor du LRC exportierst.";
  if (message.includes("Word timing omitted"))
    return "Wortzeiten gehen beim normalen LRC-Export verloren. Wähle E-LRC, um vorhandene Wortanfänge zu erhalten.";
  if (message.includes("Explicit end times omitted"))
    return "Explizite Endzeiten werden im LRC-/E-LRC-Export nicht gespeichert.";
  if (message.includes("Metadata/extensions without"))
    return "Metadaten oder Erweiterungen ohne LRC-Entsprechung werden ausgelassen.";
  if (message.includes("Separate plain version differs"))
    return "Die separate Plain-Version weicht von den synchronisierten Zeilen ab und wird ausgelassen.";
  if (message.includes("Lines reordered"))
    return "Zeilen wurden nach ihren Anfangszeiten sortiert.";
  if (message.includes("No synchronized lines"))
    return "Keine synchronisierten Zeilen vorhanden. Export als Text ohne erfundene Zeitstempel.";
  if (message.includes("exceeds 2 MiB"))
    return "Die Eingabe überschreitet das Limit von 2 MiB.";
  return message.replace(/^Error:\s*/, "");
}
