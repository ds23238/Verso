import {init, fromLrc, toLrc, type Document} from 'lyricsbridge/web';
import {init as automaticBrowserInit} from 'lyricsbridge';
async function use() {
  await init();
  await automaticBrowserInit(new Uint8Array([0]));
  const doc: Document = fromLrc('[00:01]Hello', {title: 'Typed', artist: 'Browser'}).document;
  const output: string = toLrc(doc, {enhanced: true}).output;
  return output;
}
void use;
