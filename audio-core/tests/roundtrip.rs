use std::{path::PathBuf, process::Command};
use verso_audio::{edit_bytes, inspect_bytes, Patch};
fn fixtures() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../work/audio-fixtures")
}
#[test]
fn formats_roundtrip_without_audio_changes() {
    for ext in ["mp3", "flac", "m4a"] {
        let bytes = std::fs::read(fixtures().join(format!("track.{ext}")))
            .expect("Run python scripts/audio-fixtures.py first");
        let before = inspect_bytes(&bytes).unwrap();
        let title = before.tags.iter().find(|t| t.key == "TrackTitle").unwrap();
        let p:Patch=serde_json::from_value(serde_json::json!({"fields":[{"id":title.id,"value":"Neue Version"}],"plain":"Ohne neue Zeiten"})).unwrap();
        let output = edit_bytes(&bytes, p).unwrap_or_else(|e| panic!("{ext}: {e}"));
        let after = inspect_bytes(&output).unwrap();
        assert_eq!(before.payload_sha256, after.payload_sha256);
        assert!(after
            .tags
            .iter()
            .any(|t| t.text.as_deref() == Some("Neue Version")));
        assert!(after
            .tags
            .iter()
            .any(|t| t.text.as_deref() == Some("Testalbum")));
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join(format!("out.{ext}"));
        std::fs::write(&file, output).unwrap();
        assert!(
            Command::new("ffmpeg")
                .args(["-v", "error", "-i"])
                .arg(file)
                .args(["-f", "null", "-"])
                .status()
                .unwrap()
                .success(),
            "{ext} must remain decodable"
        );
    }
}
#[test]
fn pictures_are_individual_and_invalid_edits_fail() {
    use base64::Engine;
    let png = base64::engine::general_purpose::STANDARD
        .encode(std::fs::read(fixtures().join("cover.png")).unwrap());
    for ext in ["mp3", "flac", "m4a"] {
        let bytes = std::fs::read(fixtures().join(format!("track.{ext}"))).unwrap();
        let p = serde_json::from_value(serde_json::json!({"covers":[{"data":png},{"data":png}]}))
            .unwrap();
        let output = edit_bytes(&bytes, p).unwrap_or_else(|e| panic!("{ext} add: {e}"));
        let info = inspect_bytes(&output).unwrap();
        assert_eq!(info.covers.len(), 2, "{ext}");
        let p = serde_json::from_value(serde_json::json!({"covers":[{"id":info.covers[0].id}]}))
            .unwrap();
        let edited = edit_bytes(&output, p).unwrap_or_else(|e| panic!("{ext} remove: {e}"));
        assert_eq!(inspect_bytes(&edited).unwrap().covers.len(), 1);
        let invalid =
            serde_json::from_value(serde_json::json!({"covers":[{"id":"999:999"}]})).unwrap();
        assert!(edit_bytes(&bytes, invalid).is_err());
        let invalid =
            serde_json::from_value(serde_json::json!({"fields":[{"id":"999:999","value":"bad"}]}))
                .unwrap();
        assert!(edit_bytes(&bytes, invalid).is_err());
    }
}
#[test]
fn reject_invalid_and_truncated_audio() {
    for b in [
        vec![],
        b"not audio".to_vec(),
        b"ID3\x04\0\0\x7f\x7f\x7f\x7f".to_vec(),
    ] {
        assert!(inspect_bytes(&b).is_err());
    }
}
#[test]
fn sylt_custom_lyricsfile_and_languages_survive() {
    use lofty::{
        config::{ParseOptions, WriteOptions},
        file::AudioFile,
        id3::v2::{
            BinaryFrame, ExtendedTextFrame, Frame, FrameId, SyncTextContentType,
            SynchronizedTextFrame, TimestampFormat, UnsynchronizedTextFrame,
        },
        TextEncoding,
    };
    use std::io::Cursor;
    let bytes = std::fs::read(fixtures().join("track.mp3")).unwrap();
    let mut file =
        lofty::mpeg::MpegFile::read_from(&mut Cursor::new(&bytes), ParseOptions::default())
            .unwrap();
    let sync = SynchronizedTextFrame::new(
        TextEncoding::UTF8,
        *b"deu",
        TimestampFormat::MS,
        SyncTextContentType::Lyrics,
        Some("Original".into()),
        vec![
            (500, "Hallo ".into()),
            (1000, "Welt".into()),
            (2000, "\nZeile zwei".into()),
        ],
    );
    let data = sync.as_bytes(WriteOptions::default()).unwrap();
    let tag = file.id3v2_mut().unwrap();
    tag.insert(Frame::Binary(BinaryFrame::new(
        FrameId::Valid("SYLT".into()),
        data,
    )));
    tag.insert(Frame::UserText(ExtendedTextFrame::new(
        TextEncoding::UTF8,
        "VERSO_LYRICSFILE",
        "{\"version\":\"1.0\",\"metadata\":{\"title\":\"T\",\"artist\":\"A\"},\"plain\":\"P\"}",
    )));
    tag.insert(Frame::UserText(ExtendedTextFrame::new(
        TextEncoding::UTF8,
        "PRIVATE_UNKNOWN",
        "keep this",
    )));
    tag.insert(Frame::UnsynchronizedText(UnsynchronizedTextFrame::new(
        TextEncoding::UTF8,
        *b"deu",
        "Alternative",
        "Deutsch erhalten",
    )));
    tag.insert(Frame::UnsynchronizedText(UnsynchronizedTextFrame::new(
        TextEncoding::UTF8,
        *b"eng",
        "Alternative",
        "English retained",
    )));
    let mut cursor = Cursor::new(bytes);
    file.save_to(&mut cursor, WriteOptions::default()).unwrap();
    let input = cursor.into_inner();
    let before = inspect_bytes(&input).unwrap();
    assert_eq!(before.sources.len(), 2);
    let sylt = before
        .sources
        .iter()
        .find(|s| s.label.starts_with("SYLT"))
        .unwrap();
    let doc: serde_json::Value = serde_json::from_str(&sylt.text).unwrap();
    assert_eq!(doc["lines"][0]["words"][1]["start_ms"], 1000);
    assert_eq!(doc["lines"][1]["start_ms"], 2000);
    let output = edit_bytes(
        &input,
        serde_json::from_value(
            serde_json::json!({"fields":[{"id":"@AlbumArtist","value":"Neuer Wert"}],"plain":"Updated first entry"}),
        )
        .unwrap(),
    )
    .unwrap();
    let after = inspect_bytes(&output).unwrap();
    assert_eq!(after.sources.len(), 2);
    assert!(after
        .tags
        .iter()
        .any(|t| t.text.as_deref() == Some("Deutsch erhalten")));
    assert!(after
        .tags
        .iter()
        .any(|t| t.text.as_deref() == Some("English retained")));
    assert_eq!(before.payload_sha256, after.payload_sha256);
}
#[test]
fn clear_a_tag_and_add_numeric_fields() {
    for ext in ["mp3", "flac", "m4a"] {
        let bytes = std::fs::read(fixtures().join(format!("track.{ext}"))).unwrap();
        let before = inspect_bytes(&bytes).unwrap();
        let album = &before
            .tags
            .iter()
            .find(|t| t.key == "AlbumTitle")
            .unwrap()
            .id;
        let patch=serde_json::from_value(serde_json::json!({"fields":[{"id":album,"value":null},{"id":"@TrackNumber","value":"001"}]})).unwrap();
        let output = edit_bytes(&bytes, patch).unwrap_or_else(|e| panic!("{ext}: {e}"));
        let after = inspect_bytes(&output).unwrap();
        assert!(!after.tags.iter().any(|t| t.key == "AlbumTitle"));
        assert!(after
            .tags
            .iter()
            .any(|t| t.key == "TrackNumber" && t.text.as_deref() == Some("1")));
    }
}
#[test]
fn lrc_and_neutral_lyricsfile_coexist_and_replace_independently() {
    let yaml =
        "version: '1.0'\nmetadata:\n  title: Abendlicht\n  artist: Verso Test\nplain: Grüß dich\n";
    let lrc = "[ti:Abendlicht]\n[ar:Verso Test]\n[00:00.500]Grüß dich";
    for ext in ["mp3", "flac", "m4a"] {
        let bytes = std::fs::read(fixtures().join(format!("track.{ext}"))).unwrap();
        let before = inspect_bytes(&bytes).unwrap();
        let patch =
            serde_json::from_value(serde_json::json!({"plain":lrc,"lyricsfile":yaml})).unwrap();
        let out = edit_bytes(&bytes, patch).unwrap_or_else(|e| panic!("{ext}: {e}"));
        let info = inspect_bytes(&out).unwrap();
        assert_eq!(before.payload_sha256, info.payload_sha256);
        assert!(info.tags.iter().any(|t| t.text.as_deref() == Some(lrc)));
        let source = info.sources.iter().find(|s| s.text == yaml).unwrap();
        assert!(source.label.contains("LYRICSFILE"));
        assert!(!source.label.contains("com.verso"));
        if ext == "m4a" {
            assert!(source.label.starts_with("org.lyricsfile:"));
        }
        let updated = yaml.replace("Grüß dich", "Zweite Version");
        let again = edit_bytes(
            &out,
            serde_json::from_value(serde_json::json!({"lyricsfile":updated})).unwrap(),
        )
        .unwrap();
        let info = inspect_bytes(&again).unwrap();
        assert!(info.tags.iter().any(|t| t.text.as_deref() == Some(lrc)));
        assert_eq!(
            info.sources
                .iter()
                .filter(|s| s.label.contains("LYRICSFILE"))
                .count(),
            1
        );
        assert!(info.sources.iter().any(|s| s.text == updated));
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join(format!("coexist.{ext}"));
        std::fs::write(&file, again).unwrap();
        assert!(Command::new("ffmpeg")
            .args(["-v", "error", "-xerror", "-i"])
            .arg(file)
            .args(["-f", "null", "-"])
            .status()
            .unwrap()
            .success());
    }
}
#[test]
fn selected_lyrics_variant_survives_preceding_tag_removal() {
    use lofty::{
        config::{ParseOptions, WriteOptions},
        file::AudioFile,
        id3::v2::{Frame, UnsynchronizedTextFrame},
        TextEncoding,
    };
    use std::io::Cursor;
    let bytes = std::fs::read(fixtures().join("track.mp3")).unwrap();
    let mut f = lofty::mpeg::MpegFile::read_from(&mut Cursor::new(&bytes), ParseOptions::default())
        .unwrap();
    f.id3v2_mut()
        .unwrap()
        .insert(Frame::UnsynchronizedText(UnsynchronizedTextFrame::new(
            TextEncoding::UTF8,
            *b"deu",
            "Alternative",
            "Deutsch erhalten",
        )));
    let mut c = Cursor::new(bytes);
    f.save_to(&mut c, WriteOptions::default()).unwrap();
    let bytes = c.into_inner();
    let before = inspect_bytes(&bytes).unwrap();
    let target = &before
        .tags
        .iter()
        .find(|t| t.description == "Alternative" && t.language == "deu")
        .unwrap()
        .id;
    let title = &before
        .tags
        .iter()
        .find(|t| t.key == "TrackTitle")
        .unwrap()
        .id;
    let patch=serde_json::from_value(serde_json::json!({"lyrics_target":target,"plain":"[00:01.000]Gezielt ersetzt","fields":[{"id":title,"value":null}]})).unwrap();
    let out = edit_bytes(&bytes, patch).unwrap();
    let after = inspect_bytes(&out).unwrap();
    assert!(after.tags.iter().any(|t| t.description == "Alternative"
        && t.language == "deu"
        && t.text.as_deref() == Some("[00:01.000]Gezielt ersetzt")));
    assert!(after
        .tags
        .iter()
        .any(|t| t.text.as_deref() == Some("[00:00.500]Hallo Welt\n[00:02.000]Eine zweite Zeile")));
}
#[test]
fn multiple_lyricsfile_variants_are_not_collapsed() {
    use lofty::{
        config::{ParseOptions, WriteOptions},
        file::AudioFile,
    };
    use std::io::Cursor;
    let bytes = std::fs::read(fixtures().join("track.flac")).unwrap();
    let mut f = lofty::flac::FlacFile::read_from(&mut Cursor::new(&bytes), ParseOptions::default())
        .unwrap();
    let tag = f.vorbis_comments_mut().unwrap();
    tag.push("LYRICSFILE".into(), "Version eins".into());
    tag.push("LYRICSFILE".into(), "Version zwei".into());
    tag.push("X_OTHER_APP".into(), "Unverändert".into());
    let mut c = Cursor::new(bytes);
    f.save_to(&mut c, WriteOptions::default()).unwrap();
    let input = c.into_inner();
    let patch = serde_json::from_value(serde_json::json!({"lyricsfile":"Neue Version"})).unwrap();
    assert!(edit_bytes(&input, patch)
        .unwrap_err()
        .contains("Mehrere LYRICSFILE"));
    let out = edit_bytes(
        &input,
        serde_json::from_value(serde_json::json!({"fields":[{"id":"@Genre","value":"Test"}]}))
            .unwrap(),
    )
    .unwrap();
    let after =
        lofty::flac::FlacFile::read_from(&mut Cursor::new(out), ParseOptions::default()).unwrap();
    let tag = after.vorbis_comments().unwrap();
    assert_eq!(tag.get_all("LYRICSFILE").count(), 2);
    assert_eq!(tag.get("X_OTHER_APP"), Some("Unverändert"));
}
#[test]
fn format_namespace_preserves_legacy_mp4_lyricsfile_fields() {
    use lofty::{
        config::{ParseOptions, WriteOptions},
        file::AudioFile,
        mp4::{Atom, AtomData, AtomIdent, Mp4File},
    };
    use std::io::Cursor;
    let input = std::fs::read(fixtures().join("track.m4a")).unwrap();
    let mut file = Mp4File::read_from(&mut Cursor::new(&input), ParseOptions::default()).unwrap();
    file.ilst_mut().unwrap().insert(Atom::new(
        AtomIdent::Freeform {
            mean: "com.apple.iTunes".into(),
            name: "LYRICSFILE".into(),
        },
        AtomData::UTF8("Unveränderter Altbestand".into()),
    ));
    let mut cursor = Cursor::new(input);
    file.save_to(&mut cursor, WriteOptions::default()).unwrap();
    let input = cursor.into_inner();
    let before = inspect_bytes(&input).unwrap();
    let yaml = "version: '1.0'\nmetadata:\n  title: Neuer Namensraum\n  artist: CI\nplain: Text\n";
    let patch = serde_json::from_value(serde_json::json!({"lyricsfile":yaml})).unwrap();
    let output = edit_bytes(&input, patch).unwrap();
    let info = inspect_bytes(&output).unwrap();
    assert_eq!(info.payload_sha256, before.payload_sha256);
    assert!(info
        .sources
        .iter()
        .any(|s| s.label == "org.lyricsfile:LYRICSFILE (Erweiterung)" && s.text == yaml));
    assert!(info
        .sources
        .iter()
        .any(|s| s.label == "com.apple.iTunes:LYRICSFILE (Erweiterung)"
            && s.text == "Unveränderter Altbestand"));
    let patch = serde_json::from_value(
        serde_json::json!({"lyricsfile":yaml.replace("Neuer Namensraum","Aktualisiert")}),
    )
    .unwrap();
    let output = edit_bytes(&output, patch).unwrap();
    let info = inspect_bytes(&output).unwrap();
    assert_eq!(
        info.sources
            .iter()
            .filter(|s| s.label.starts_with("org.lyricsfile:"))
            .count(),
        1
    );
    assert!(info
        .sources
        .iter()
        .any(|s| s.label.starts_with("org.lyricsfile:") && s.text.contains("Aktualisiert")));
    assert!(info
        .sources
        .iter()
        .any(|s| s.label.starts_with("com.apple.iTunes:") && s.text == "Unveränderter Altbestand"));
}
