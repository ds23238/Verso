import { mkdir, cp, rm } from "node:fs/promises";
await rm("release/verso-web", { recursive: true, force: true });
await mkdir("release/verso-web", { recursive: true });
await cp("dist", "release/verso-web", { recursive: true });
console.log("Statisch hostbare App: release/verso-web/");
