use lyricsfile::*;

fn sample() -> Document {
    Document {
        version: "1.0".into(),
        metadata: Metadata {
            title: "Song".into(),
            artist: "Artist".into(),
            ..Default::default()
        },
        lines: vec![Line {
            text: "Hello".into(),
            start_ms: 1200,
            end_ms: None,
            words: vec![],
            extra: Extensions::new(),
        }],
        plain: None,
        extra: Extensions::new(),
    }
}

#[test]
fn roundtrip_and_extensions() {
    let mut doc = sample();
    doc.extra.insert(
        "x-app".into(),
        serde_json::json!({"enabled": true, "items": [null, 7, "日本語"]}),
    );
    doc.lines[0].extra.insert("speaker".into(), "A".into());
    assert_eq!(from_yaml(&to_yaml(&doc).unwrap()).unwrap(), doc);
}

#[test]
fn rejects_duplicate_keys_and_extra_documents() {
    let yaml = to_yaml(&sample()).unwrap();
    assert!(from_yaml(&(yaml.clone() + "version: '1.0'\n")).is_err());
    assert!(from_yaml(&(yaml + "---\nversion: '1.0'\n")).is_err());
    let nested = "version: '1.0'\nmetadata: {title: A, artist: B, title: C}\n";
    assert!(from_yaml(nested).is_err());
}

#[test]
fn rejects_tags_floats_missing_identity_and_wrong_types() {
    for yaml in [
        "version: '1.0'\nmetadata: {title: A}\n",
        "version: 1.0\nmetadata: {title: A, artist: B}\n",
        "version: '1.0'\nmetadata: {title: A, artist: B}\nx: !custom test\n",
        "version: '1.0'\nmetadata: {title: A, artist: B}\nx: 1.5\n",
        "version: '1.0'\nmetadata: {title: A, artist: B}\nx: {1: bad}\n",
    ] {
        assert!(from_yaml(yaml).is_err(), "Accepted {yaml}");
    }
}

#[test]
fn timing_errors_and_warnings_are_separate() {
    let mut doc = sample();
    doc.lines[0].end_ms = Some(1000);
    assert!(ensure_valid(&doc).is_err());
    doc.lines[0].end_ms = None;
    doc.metadata.duration_ms = Some(1000);
    assert!(ensure_valid(&doc).is_ok());
    assert!(validate(&doc).iter().any(|d| d.severity == "warning"));
}

#[test]
fn instrumental_and_unknown_version_rejected() {
    let mut doc = sample();
    doc.version = "2.0".into();
    assert!(ensure_valid(&doc).is_err());
    doc.version = "1.0".into();
    doc.metadata.instrumental = true;
    assert!(ensure_valid(&doc).is_err());
    doc.lines.clear();
    assert!(ensure_valid(&doc).is_ok());
}

#[test]
fn bounds_are_enforced() {
    assert!(from_yaml(&" ".repeat(MAX_BYTES + 1)).is_err());
    let nested = format!(
        "version: '1.0'\nmetadata: {{title: A, artist: B}}\nx: {}0{}",
        "[".repeat(70),
        "]".repeat(70)
    );
    assert!(from_yaml(&nested).is_err());
}

#[test]
fn actual_external_lyricsfile() {
    let root = std::env::var("LYRICS_TEST_INPUTS").unwrap_or_else(|_| "../work/test-inputs".into());
    let yaml = std::fs::read_to_string(format!("{root}/example.lyricsfile.yaml")).unwrap();
    let doc = from_yaml(&yaml).unwrap();
    assert_eq!(doc.lines[0].words[1].start_ms, 1800);
    assert_eq!(from_yaml(&to_yaml(&doc).unwrap()).unwrap(), doc);
}
