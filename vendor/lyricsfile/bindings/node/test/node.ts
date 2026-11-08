import { parse, stringify, validate, type Document, type Word } from 'lyricsfile';
const doc: Document = {version: '1.0', metadata: {title: 'Typed', artist: 'Node'},
  lines: [{text: 'Hello', start_ms: 1200, words: [{text: 'Hello', start_ms: 1200}]}]};
const parsed = parse(stringify(doc));
const word: Word | undefined = parsed.document.lines?.[0]?.words?.[0];
if (word?.start_ms !== 1200 || validate(parsed.document).length) throw new Error('Typed Node API failed');
if (false) {
  // @ts-expect-error Title is required.
  const invalid: Document = {version: '1.0', metadata: {artist: 'A'}};
  // @ts-expect-error Timing is numeric.
  const invalidWord: Word = {text: 'Hi', start_ms: '1200'};
  void invalid; void invalidWord;
}
