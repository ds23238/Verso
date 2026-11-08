import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createApi } from './shared/api.js';
const require = createRequire(import.meta.url);
let native;
export const { parse, stringify, validate } = createApi(() => {
  native ??= require(process.env.LYRICSFILE_NODE_LIBRARY ?? fileURLToPath(new URL('../../build/lyricsfile.node', import.meta.url)));
  return native.request;
});
