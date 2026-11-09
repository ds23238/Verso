fn main() {
    let p = std::env::args().nth(1).unwrap();
    let b = std::fs::read(p).unwrap();
    println!(
        "{}",
        serde_json::to_string_pretty(&verso_audio::inspect_bytes(&b).unwrap()).unwrap()
    );
}
