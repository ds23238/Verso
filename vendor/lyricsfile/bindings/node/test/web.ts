import {init, parse, stringify, type Document} from 'lyricsfile/web';
import {init as automaticBrowserInit} from 'lyricsfile';
const doc: Document = {version: '1.0', metadata: {title: 'Typed', artist: 'Browser'}, plain: 'Hello'};
async function use() {
  await init(new URL('/assets/lyricsfile_bg.wasm', location.href));
  await automaticBrowserInit();
  const text: string | null | undefined = parse(stringify(doc)).document.plain;
  return text;
}
void use;
