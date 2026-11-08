import {fromLrc, toLrc, type Document, type ImportOptions, type Word} from 'lyricsbridge';
const options: ImportOptions = {title: 'Typed', artist: 'Node', offset: 'reject'};
const result = fromLrc('[00:01.200]<00:01.200>Hello', options);
const doc: Document = result.document;
const word: Word | undefined = doc.lines?.[0]?.words?.[0];
if (word?.start_ms !== 1200 || !toLrc(doc, {enhanced: true}).output.includes('<00:01.200>')) throw new Error('Typed Node API failed');
if (false) {
  // @ts-expect-error Reject unsupported offset policies.
  fromLrc('Hi', {offset: 'guess'});
  // @ts-expect-error Enhanced is boolean.
  toLrc(doc, {enhanced: 'yes'});
}
