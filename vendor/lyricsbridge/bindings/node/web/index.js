import initializeWasm, { request } from './wasm/lyricsbridge.js';
import { createApi } from '../shared/api.js';
let ready = false;
let pending;

/** Initialize once before calling the synchronous conversion API. */
export function init(input) {
  if (ready) return Promise.resolve();
  if (!pending) {
    pending = initializeWasm(input === undefined ? undefined : {module_or_path: input})
      .then(() => { ready = true; })
      .catch(error => { pending = undefined; throw error; });
  }
  return pending;
}
export const { fromLrc, toLrc } = createApi(() => {
  if (!ready) throw new Error('lyricsbridge: call and await init() before using the browser API');
  return request;
});
