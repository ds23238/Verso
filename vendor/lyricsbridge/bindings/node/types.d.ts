import type { Document } from 'lyricsfile';
export type { Document, Metadata, Line, Word, Diagnostic } from 'lyricsfile';
export interface ImportOptions {
  title?: string;
  artist?: string;
  offset?: 'reject' | 'apply' | 'ignore';
}
export interface ImportResult {
  document: Document;
  yaml: string;
  warnings: string[];
}
export interface ExportOptions { enhanced?: boolean; }
export interface ExportResult { output: string; warnings: string[]; }
