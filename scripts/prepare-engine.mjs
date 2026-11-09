import { cp, mkdir, access } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve, sep } from "node:path";
const root = new URL("../", import.meta.url);
for (const name of ["lyricsfile", "lyricsbridge"]) {
  const source = process.env.VERSO_ENGINE_DIR
    ? new URL(
        `${name}/`,
        pathToFileURL(resolve(process.env.VERSO_ENGINE_DIR) + sep),
      )
    : new URL(`../${name}/bindings/node/`, root);
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

if (process.env.VERSO_ENGINE_DIR) {
  const source = resolve(process.env.VERSO_ENGINE_DIR, "audio");
  await cp(source, new URL("public/engine/audio/", root), { recursive: true });
} else {
  await access(new URL("public/engine/audio/audio_bg.wasm", root)).catch(() => {
    throw new Error("Audio-WASM fehlt. Zuerst npm run audio:build ausführen.");
  });
}
