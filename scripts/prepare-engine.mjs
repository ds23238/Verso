import { cp, mkdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
for (const name of ["lyricsfile", "lyricsbridge"]) {
  const source = new URL(`../${name}/bindings/node/`, root);
  try {
    await access(new URL(`web/wasm/${name}_bg.wasm`, source));
  } catch {
    throw new Error(
      `${name}: WASM fehlt. Zuerst npm run engine:build mit Rust und wasm-bindgen im PATH ausführen.`,
    );
  }
  const target = new URL(`public/engine/${name}/`, root);
  await mkdir(target, { recursive: true });
  for (const directory of ["web", "shared"])
    await cp(new URL(directory, source), new URL(directory, target), {
      recursive: true,
    });
  console.log("Prepared", name, fileURLToPath(target));
}
