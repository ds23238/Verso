/** Lyricsfile 1.0 draft. Unknown extension fields are preserved. */
export interface Word {
  text: string;
  start_ms: number;
  end_ms?: number | null;
  [extension: string]: unknown;
}
export interface Line {
  text: string;
  start_ms: number;
  end_ms?: number | null;
  words?: Word[];
  [extension: string]: unknown;
}
export interface Metadata {
  title: string;
  artist: string;
  album?: string | null;
  duration_ms?: number | null;
  offset_ms?: number | null;
  language?: string | null;
  instrumental?: boolean;
  [extension: string]: unknown;
}
export interface Document {
  version: '1.0';
  metadata: Metadata;
  lines?: Line[];
  plain?: string | null;
  [extension: string]: unknown;
}
export interface Diagnostic {
  severity: 'error' | 'warning';
  path: string;
  message: string;
}
export interface ParseResult {
  document: Document;
  warnings: Diagnostic[];
}
