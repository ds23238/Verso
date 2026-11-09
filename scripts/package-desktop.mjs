import { mkdir, copyFile, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
const { version } = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const platform = process.platform === "win32" ? "windows" : process.platform;
const name = process.platform === "win32" ? "verso.exe" : "verso";
const folder = join("release", `verso-${platform}-${process.arch}`);
await mkdir(folder, { recursive: true });
await copyFile(
  join("src-tauri", "target", "release", name),
  join(folder, name),
);
await writeFile(
  join(folder, "README.txt"),
  `Verso ${version}\n\nStart the included executable. No installer and no backend required.\nLinux requires the WebKitGTK 4.1 and GTK 3 runtime libraries.\nWindows requires WebView2 Runtime.\nUnexported lyrics remain in memory and are lost when the app is closed.\nAudio files: MP3, FLAC, M4A/AAC up to 64 MiB. Exports are verified copies; audio plus sidecars are packaged as ZIP.\n`,
);
console.log("Portable executable:", join(folder, name));
