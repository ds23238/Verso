import type { Document, ImportOptions, ImportResult, ExportOptions, ExportResult } from '../types.js';
export type { Document, Metadata, Line, Word, Diagnostic, ImportOptions, ImportResult, ExportOptions, ExportResult } from '../types.js';
export function fromLrc(source: string, options?: ImportOptions): ImportResult;
export function toLrc(source: string | Document, options?: ExportOptions): ExportResult;
/** Loads the adjacent WASM asset by default. Supply a URL or bytes for custom hosting. */
export type InitInput = string | URL | Request | Response | BufferSource | WebAssembly.Module;
export function init(input?: InitInput): Promise<void>;
