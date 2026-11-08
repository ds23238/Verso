import type { Document, ParseResult, Diagnostic } from './types.js';
export type { Document, Metadata, Line, Word, ParseResult, Diagnostic } from './types.js';
export function parse(source: string): ParseResult;
export function stringify(document: Document): string;
export function validate(document: Document): Diagnostic[];
