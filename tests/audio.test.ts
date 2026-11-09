import { describe, it, expect } from "vitest";
import { lyricOverrides } from "../src/audio/model";
describe("audio lyric identities", () => {
  const tags = {
    title: "Track title",
    artist: "Track artist",
    album: "Track album",
  };
  it("keeps an opened sidecar identity until alignment is explicitly selected", () => {
    const text = "[ti:Sidecar title]\n[ar:Sidecar artist]\n[00:01]Text";
    expect(lyricOverrides(text, "auto", tags, false)).toEqual({});
    expect(lyricOverrides(text, "auto", tags, true)).toEqual(tags);
  });
  it("fills only absent identities without inventing metadata", () => {
    expect(lyricOverrides("[ti:Own]\nPlain", "auto", tags, false)).toEqual({
      artist: "Track artist",
    });
    expect(
      lyricOverrides(
        "Plain",
        "auto",
        { title: "", artist: "", album: "" },
        false,
      ),
    ).toEqual({});
  });
  it("preserves auto-detected and explicit Lyricsfile metadata", () => {
    expect(
      lyricOverrides(
        "version: 1.0\nmetadata:\n  title: Own",
        "auto",
        tags,
        false,
      ),
    ).toEqual({});
    expect(
      lyricOverrides('{"metadata":{"title":"Own"}}', "auto", tags, false),
    ).toEqual({});
    expect(lyricOverrides("", "lyricsfile", tags, false)).toEqual({});
  });
});
