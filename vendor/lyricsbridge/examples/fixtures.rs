//! Emit reference snapshots to compare every binding with the direct Rust API.
use serde_json::json;
fn main() {
    let root = std::env::var("LYRICS_TEST_INPUTS").expect("LYRICS_TEST_INPUTS required");
    let mut outputs = serde_json::Map::new();
    for name in ["normal.lrc", "enhanced.lrc"] {
        let source = std::fs::read_to_string(format!("{root}/{name}")).unwrap();
        outputs.insert(
            name.into(),
            lyricsbridge::dispatch(json!({"op": "from_lrc", "source": source})).unwrap(),
        );
    }
    let source = std::fs::read_to_string(format!("{root}/example.lyricsfile.yaml")).unwrap();
    for enhanced in [false, true] {
        outputs.insert(
            if enhanced {
                "yaml-enhanced"
            } else {
                "yaml-normal"
            }
            .into(),
            lyricsbridge::dispatch(json!({"op": "to_lrc", "source": source, "enhanced": enhanced}))
                .unwrap(),
        );
    }
    std::fs::write(
        format!("{root}/../results-rust.json"),
        serde_json::to_string(&outputs).unwrap(),
    )
    .unwrap();
    println!("Rust reference snapshots written");
}
