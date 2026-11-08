import { spawnSync } from "node:child_process";
if (process.platform === "linux") {
  const result = spawnSync(
    "pkg-config",
    ["--exists", "webkit2gtk-4.1", "gtk+-3.0"],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    console.error(
      "Desktop-Build benötigt WebKitGTK/GTK-Entwicklungspakete: libwebkit2gtk-4.1-dev, libgtk-3-dev, libayatana-appindicator3-dev, librsvg2-dev und patchelf. Sie sind hier nicht installiert. Siehe docs/DESKTOP.md.",
    );
    process.exit(1);
  }
}
if (spawnSync("cargo", ["--version"], { encoding: "utf8" }).status !== 0) {
  console.error("Rust/Cargo muss im PATH liegen.");
  process.exit(1);
}
