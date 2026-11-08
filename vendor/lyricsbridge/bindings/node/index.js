import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createApi } from './shared/api.js';
const require = createRequire(import.meta.url);
let native;
export const { fromLrc, toLrc } = createApi(() => {
  native ??= require(process.env.LYRICSBRIDGE_NODE_LIBRARY ?? fileURLToPath(new URL('../../build/lyricsbridge.node', import.meta.url)));
  return native.request;
});
