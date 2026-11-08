#[test]
fn cannot_write_duplicate_keys_via_extensions() {
    let mut doc =
        lyricsfile::from_yaml("version: '1.0'\nmetadata: {title: A, artist: B}\nplain: Hello\n")
            .unwrap();
    doc.extra.insert("version".into(), "2.0".into());
    assert!(lyricsfile::to_yaml(&doc).is_err());
}
