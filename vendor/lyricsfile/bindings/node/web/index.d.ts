import type { Document, ParseResult, Diagnostic } from '../types.js';
export type { Document, Metadata, Line, Word, ParseResult, Diagnostic } from '../types.js';
export function parse(source: string): ParseResult;
export function stringify(document: Document): string;
export function validate(document: Document): Diagnostic[];
/** Loads the adjacent WASM asset by default. Supply a URL or bytes for custom hosting. */
export type InitInput = string | URL | Request | Response | BufferSource | WebAssembly.Module;
export function init(input?: InitInput): Promise<void>;
