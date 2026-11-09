import { detect, type SourceFormat } from "../conversion/engine";
/** Track metadata fills absent LRC identities. Existing lyric metadata changes only by explicit choice. */
export function lyricOverrides(
  text: string,
  format: SourceFormat,
  track: { title: string; artist: string; album: string },
  align: boolean,
) {
  if (align) return track;
  if (format === "lyricsfile" || detect(text) === "lyricsfile") return {};
  return {
    ...(!/^\s*\[ti:[^\]]*\]/m.test(text) && track.title
      ? { title: track.title }
      : {}),
    ...(!/^\s*\[ar:[^\]]*\]/m.test(text) && track.artist
      ? { artist: track.artist }
      : {}),
  };
}
