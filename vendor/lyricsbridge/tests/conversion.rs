use lyricsbridge::*;

fn opts() -> ImportOptions {
    ImportOptions {
        title: Some("Song".into()),
        artist: Some("Artist".into()),
        ..Default::default()
    }
}
fn input(name: &str) -> String {
    let root = std::env::var("LYRICS_TEST_INPUTS").unwrap_or_else(|_| "../work/test-inputs".into());
    std::fs::read_to_string(format!("{root}/{name}")).unwrap()
}

#[test]
fn normal_fixture_roundtrip() {
    let doc = from_lrc(&input("normal.lrc"), &ImportOptions::default())
        .unwrap()
        .output;
    assert_eq!(doc.lines.len(), 4);
    assert_eq!(doc.lines[0].start_ms, 1200);
    assert_eq!(doc.lines[2].start_ms, 9500);
    assert!(doc
        .lines
        .iter()
        .all(|l| l.words.is_empty() && l.end_ms.is_none()));
    let exported = to_lrc(&doc, false).unwrap();
    let again = from_lrc(&exported.output, &ImportOptions::default())
        .unwrap()
        .output;
    assert_eq!(doc.lines, again.lines);
    assert_eq!(doc.metadata, again.metadata);
}

#[test]
fn enhanced_fixture_roundtrip() {
    let doc = from_lrc(&input("enhanced.lrc"), &ImportOptions::default())
        .unwrap()
        .output;
    assert_eq!(doc.lines[0].words[0].text, "Hallo ");
    assert_eq!(doc.lines[0].words[1].start_ms, 1800);
    assert!(doc.lines[0].words.iter().all(|w| w.end_ms.is_none()));
    let enhanced = to_lrc(&doc, true).unwrap();
    assert_eq!(
        from_lrc(&enhanced.output, &ImportOptions::default())
            .unwrap()
            .output
            .lines,
        doc.lines
    );
    assert!(to_lrc(&doc, false)
        .unwrap()
        .warnings
        .iter()
        .any(|w| w.contains("Word timing")));
}

#[test]
fn lyricsfile_fixture_exports_both_formats() {
    let doc = lyricsfile::from_yaml(&input("example.lyricsfile.yaml")).unwrap();
    for enhanced in [false, true] {
        let result = to_lrc(&doc, enhanced).unwrap();
        assert!(result.warnings.iter().any(|w| w.contains("end times")));
        assert!(result.warnings.iter().any(|w| w.contains("Metadata")));
        let again = from_lrc(&result.output, &ImportOptions::default())
            .unwrap()
            .output;
        assert_eq!(again.lines[0].text, doc.lines[0].text);
        assert_eq!(again.lines[0].start_ms, doc.lines[0].start_ms);
        assert_eq!(again.lines[0].words.is_empty(), !enhanced);
    }
}

#[test]
fn offsets_are_explicit_and_apply_to_words() {
    let source = "[offset:-200]\n[00:01]<00:01.200>Hello";
    assert!(from_lrc(source, &opts()).is_err());
    let mut options = opts();
    options.offset = "apply".into();
    let doc = from_lrc(source, &options).unwrap().output;
    assert_eq!(doc.lines[0].start_ms, 800);
    assert_eq!(doc.lines[0].words[0].start_ms, 1000);
    assert!(from_lrc("[offset:-2000]\n[00:01]Hello", &options).is_err());
}

#[test]
fn precision_unicode_sorting_and_blank_cues() {
    let doc = from_lrc(
        "\u{feff}[00:03.123]日本語\r\n[00:01.2][00:01.20] A \r\n[00:02]\r\n",
        &opts(),
    )
    .unwrap()
    .output;
    assert_eq!(
        doc.lines.iter().map(|l| l.start_ms).collect::<Vec<_>>(),
        vec![1200, 1200, 2000, 3123]
    );
    assert_eq!(doc.lines[0].text, " A ");
    assert_eq!(doc.lines[2].text, "");
}

#[test]
fn malformed_or_ambiguous_input_rejected() {
    for source in [
        "[00:60]Bad",
        "[00:01.1234]Bad",
        "[00:01]prefix<00:01>Word",
        "[00:01][00:02]<00:01>Word",
        "[00:01]<00:02>A<00:01>B",
        "[999999999999999999999999:00]A",
    ] {
        assert!(from_lrc(source, &opts()).is_err(), "Accepted {source}");
    }
}

#[test]
fn unknown_tags_preserved() {
    let doc = from_lrc("[by:Editor]\n[00:01]Hello", &opts())
        .unwrap()
        .output;
    assert!(to_lrc(&doc, false).unwrap().output.contains("[by:Editor]"));
}

#[test]
fn malformed_extension_tags_are_not_silently_lost() {
    let mut doc = from_lrc("[00:01]Hello", &opts()).unwrap().output;
    doc.extra.insert("x-lrc-tags".into(), serde_json::json!(7));
    assert!(to_lrc(&doc, false).is_err());
    doc.extra
        .insert("x-lrc-tags".into(), serde_json::json!({"offset": "500"}));
    assert!(to_lrc(&doc, false).is_err());
}

#[test]
fn plain_only_does_not_invent_times() {
    let doc = from_lrc("Hello\n\nWorld", &opts()).unwrap().output;
    assert!(doc.lines.is_empty());
    assert_eq!(doc.plain.as_deref(), Some("Hello\n\nWorld"));
    assert!(!to_lrc(&doc, false).unwrap().output.contains("[00:"));
}

#[test]
fn refuses_unrepresentable_lyrics_and_offsets() {
    let mut doc = from_lrc("[00:01]Hello", &opts()).unwrap().output;
    doc.lines[0].text = "Hello\nWorld".into();
    assert!(to_lrc(&doc, false).is_err());
    doc.lines[0].text = "Hello".into();
    doc.metadata.offset_ms = Some(10);
    assert!(to_lrc(&doc, false).is_err());
}
