import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
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
  "Verso 0.1.0\n\nStart the included executable. No installer and no backend required.\nLinux requires the WebKitGTK 4.1 and GTK 3 runtime libraries.\nWindows requires WebView2 Runtime.\nUnexported lyrics remain in memory and are lost when the app is closed.\n",
);
console.log("Portable executable:", join(folder, name));
