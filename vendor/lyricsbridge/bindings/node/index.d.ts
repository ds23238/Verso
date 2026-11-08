import type { Document, ImportOptions, ImportResult, ExportOptions, ExportResult } from './types.js';
export type { Document, Metadata, Line, Word, Diagnostic, ImportOptions, ImportResult, ExportOptions, ExportResult } from './types.js';
export function fromLrc(source: string, options?: ImportOptions): ImportResult;
export function toLrc(source: string | Document, options?: ExportOptions): ExportResult;
