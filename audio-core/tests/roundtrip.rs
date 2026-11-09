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
