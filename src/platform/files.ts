export const MAX_BYTES = 2 * 1024 * 1024;
export function decodeFile(bytes: ArrayBuffer): string {
  if (bytes.byteLength > MAX_BYTES)
    throw new Error("Datei ist größer als 2 MiB.");
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(
      "Die Datei ist nicht gültig UTF-8. Bitte zuvor als UTF-8 speichern.",
    );
  }
}
export function isDesktop() {
  return "__TAURI_INTERNALS__" in window;
}
export async function openNative() {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<{ name: string; content: string } | null>("open_lyrics_file");
}
export async function saveFile(name: string, content: string) {
  if (isDesktop()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<boolean>("save_lyrics_file", { name, content });
  }
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/plain;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
