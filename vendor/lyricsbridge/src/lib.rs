//! Bidirectional conversion. Never invents timing or silently discards losses.
use lyricsfile::{Document, Extensions, Line, Metadata, Word};
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct ImportOptions {
    pub title: Option<String>,
    pub artist: Option<String>,
    /// reject (default), apply (add the LRC offset), ignore.
    pub offset: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Conversion<T> {
    pub output: T,
    pub warnings: Vec<String>,
}

fn milliseconds(minutes: &str, seconds: &str, fraction: Option<&str>) -> Result<i64, String> {
    let m: i64 = minutes.parse().map_err(|_| "Minutes overflow")?;
    let s: i64 = seconds.parse().map_err(|_| "Invalid seconds")?;
    let f = format!("{fraction:0<3}", fraction = fraction.unwrap_or(""));
    m.checked_mul(60_000)
        .and_then(|v| v.checked_add(s * 1000))
        .and_then(|v| v.checked_add(f.parse::<i64>().ok()?))
        .ok_or("Timestamp overflow".into())
}

pub fn from_lrc(source: &str, options: &ImportOptions) -> Result<Conversion<Document>, String> {
    if source.len() > lyricsfile::MAX_BYTES {
        return Err("Input exceeds 2 MiB".into());
    }
    let policy = if options.offset.is_empty() {
        "reject"
    } else {
        &options.offset
    };
    if !["reject", "apply", "ignore"].contains(&policy) {
        return Err("Invalid offset policy".into());
    }
    let stamp = Regex::new(r"^\[(\d+):([0-5]\d)(?:\.(\d{1,3}))?\]").unwrap();
    let word = Regex::new(r"<(\d+):([0-5]\d)(?:\.(\d{1,3}))?>").unwrap();
    let suspicious = Regex::new(r"[\[<][-+]?\d").unwrap();
    let tag = Regex::new(r"^\[([A-Za-z][A-Za-z0-9_-]*):(.*)\]$").unwrap();
    let mut tags = std::collections::BTreeMap::new();
    let mut lines = vec![];
    let mut plain = vec![];
    let mut warnings = vec![];
    for (index, raw) in source.trim_start_matches('\u{feff}').lines().enumerate() {
        let err = |msg: &str| format!("Line {}: {msg}", index + 1);
        if let Some(c) = tag.captures(raw.trim()) {
            let key = c[1].to_lowercase();
            if tags.insert(key.clone(), c[2].trim().to_string()).is_some() {
                warnings.push(err(&format!("Repeated tag {key}; last value used")));
            }
            continue;
        }
        let mut remaining = raw;
        let mut starts = vec![];
        while let Some(c) = stamp.captures(remaining) {
            starts.push(
                milliseconds(&c[1], &c[2], c.get(3).map(|m| m.as_str())).map_err(|e| err(&e))?,
            );
            remaining = &remaining[c[0].len()..];
        }
        let markers: Vec<_> = word.captures_iter(remaining).collect();
        let mut words = vec![];
        let text;
        if !markers.is_empty() {
            if starts.len() != 1 {
                return Err(err("Enhanced LRC requires exactly one line timestamp"));
            }
            if markers[0].get(0).unwrap().start() != 0 {
                return Err(err("Text before first word marker is ambiguous"));
            }
            for (i, c) in markers.iter().enumerate() {
                let begin = c.get(0).unwrap().end();
                let end = markers
                    .get(i + 1)
                    .map(|n| n.get(0).unwrap().start())
                    .unwrap_or(remaining.len());
                let segment = &remaining[begin..end];
                if suspicious.is_match(segment) {
                    return Err(err("Malformed timestamp in word segment"));
                }
                words.push(Word {
                    text: segment.into(),
                    start_ms: milliseconds(&c[1], &c[2], c.get(3).map(|m| m.as_str()))
                        .map_err(|e| err(&e))?,
                    end_ms: None,
                    extra: Extensions::new(),
                });
            }
            if words.windows(2).any(|w| w[0].start_ms > w[1].start_ms) {
                return Err(err("Word timestamps must be ordered"));
            }
            text = words.iter().map(|w| w.text.as_str()).collect::<String>();
        } else {
            if suspicious.is_match(remaining) {
                return Err(err("Invalid or unsupported timestamp"));
            }
            text = remaining.to_string();
        }
        for start in starts {
            lines.push(Line {
                text: text.clone(),
                start_ms: start,
                end_ms: None,
                words: words.clone(),
                extra: Extensions::new(),
            });
        }
        plain.push(text);
    }
    let mut metadata = Metadata {
        title: options
            .title
            .clone()
            .or_else(|| tags.get("ti").cloned())
            .ok_or("Missing title; provide title or [ti:]")?,
        artist: options
            .artist
            .clone()
            .or_else(|| tags.get("ar").cloned())
            .ok_or("Missing artist; provide artist or [ar:]")?,
        album: tags.get("al").cloned(),
        ..Default::default()
    };
    if let Some(length) = tags.get("length") {
        let input = format!("[{length}]");
        let c = stamp
            .captures(&input)
            .filter(|c| c[0].len() == input.len())
            .ok_or("Invalid length tag")?;
        metadata.duration_ms = Some(milliseconds(&c[1], &c[2], c.get(3).map(|m| m.as_str()))?);
    }
    if let Some(offset) = tags.get("offset") {
        let offset: i64 = offset
            .parse()
            .map_err(|_| "Invalid offset; expected signed integer ms")?;
        if offset != 0 {
            if policy == "reject" {
                return Err("Nonzero LRC offset: choose apply or ignore explicitly".into());
            }
            warnings.push(format!("LRC offset {offset} ms: {policy}"));
        }
        if policy == "apply" {
            for line in &mut lines {
                line.start_ms = line.start_ms.checked_add(offset).ok_or("Offset overflow")?;
                for word in &mut line.words {
                    word.start_ms = word.start_ms.checked_add(offset).ok_or("Offset overflow")?;
                }
            }
        }
    }
    let unknown: Extensions = tags
        .iter()
        .filter(|(k, _)| !["ti", "ar", "al", "length", "offset"].contains(&k.as_str()))
        .map(|(k, v)| (k.clone(), Value::String(v.clone())))
        .collect();
    let mut extra = Extensions::new();
    if !unknown.is_empty() {
        warnings.push("Unmapped LRC tags preserved in x-lrc-tags extension".into());
        extra.insert("x-lrc-tags".into(), serde_json::to_value(unknown).unwrap());
    }
    if lines.windows(2).any(|w| w[0].start_ms > w[1].start_ms) {
        warnings.push("Lines reordered by start_ms".into());
    }
    lines.sort_by_key(|l| l.start_ms);
    let doc = Document {
        version: "1.0".into(),
        metadata,
        lines,
        plain: if plain.is_empty() {
            None
        } else {
            Some(plain.join("\n"))
        },
        extra,
    };
    lyricsfile::ensure_valid(&doc)?;
    warnings.extend(
        lyricsfile::validate(&doc)
            .into_iter()
            .map(|d| format!("{}: {}", d.path, d.message)),
    );
    Ok(Conversion {
        output: doc,
        warnings,
    })
}

fn timestamp(ms: i64) -> String {
    format!(
        "{:02}:{:02}.{:03}",
        ms / 60_000,
        (ms / 1000) % 60,
        ms % 1000
    )
}

fn safe_line(text: &str) -> Result<(), String> {
    if text.contains(['\n', '\r', '\0']) {
        Err("LRC cannot represent embedded newlines or NUL in a line/tag".into())
    } else {
        Ok(())
    }
}

pub fn to_lrc(doc: &Document, enhanced: bool) -> Result<Conversion<String>, String> {
    lyricsfile::ensure_valid(doc)?;
    if doc.metadata.offset_ms.is_some_and(|v| v != 0) {
        return Err(
            "Lyricsfile offset semantics unresolved; resolve offset_ms before export".into(),
        );
    }
    if doc.metadata.instrumental {
        return Err("Instrumental status cannot be represented in LRC".into());
    }
    let mut warnings: Vec<String> = lyricsfile::validate(doc)
        .into_iter()
        .map(|d| format!("{}: {}", d.path, d.message))
        .collect();
    let mut rows = vec![];
    for (key, value) in [
        ("ti", Some(&doc.metadata.title)),
        ("ar", Some(&doc.metadata.artist)),
        ("al", doc.metadata.album.as_ref()),
    ] {
        if let Some(v) = value {
            safe_line(v)?;
            rows.push(format!("[{key}:{v}]"));
        }
    }
    if let Some(d) = doc.metadata.duration_ms {
        rows.push(format!("[length:{}]", timestamp(d)));
    }
    if doc.extra.get("x-lrc-tags").is_some_and(|v| !v.is_object()) {
        return Err("x-lrc-tags must be an object of string values".into());
    }
    if let Some(Value::Object(tags)) = doc.extra.get("x-lrc-tags") {
        for (key, value) in tags {
            if ["ti", "ar", "al", "length", "offset"].contains(&key.as_str()) {
                return Err("x-lrc-tags must not override reserved LRC tags".into());
            }
            if !["ti", "ar", "al", "length", "offset"].contains(&key.as_str()) {
                if !Regex::new(r"^[A-Za-z][A-Za-z0-9_-]*$")
                    .unwrap()
                    .is_match(key)
                {
                    return Err("Invalid extension tag name".into());
                }
                let value = value.as_str().ok_or("LRC extension tag must be a string")?;
                safe_line(value)?;
                rows.push(format!("[{key}:{value}]"));
            }
        }
    }
    if doc.metadata.language.is_some()
        || !doc.metadata.extra.is_empty()
        || doc.extra.keys().any(|k| k != "x-lrc-tags")
    {
        warnings.push("Metadata/extensions without an LRC equivalent omitted".into());
    }
    let mut ordered: Vec<_> = doc.lines.iter().collect();
    ordered.sort_by_key(|l| l.start_ms);
    let marker = Regex::new(r"[\[<][-+]?\d").unwrap();
    if ordered.is_empty() {
        let plain = doc.plain.as_deref().ok_or("No lyrics to export")?;
        // No invented timestamps: output unsynchronized text with metadata.
        if plain.lines().any(|s| s.trim_start().starts_with('['))
            || marker.is_match(plain)
            || plain.contains('\0')
        {
            return Err("Plain text contains syntax that would be reinterpreted as LRC".into());
        }
        rows.push(plain.into());
        warnings.push("No synchronized lines; exported unsynchronized text".into());
    } else {
        if let Some(plain) = &doc.plain {
            let derived = ordered
                .iter()
                .map(|l| l.text.as_str())
                .collect::<Vec<_>>()
                .join("\n");
            if plain != &derived {
                warnings.push(
                    "Separate plain version differs from synchronized lines and is omitted".into(),
                );
            }
        }
        for line in ordered {
            safe_line(&line.text)?;
            if marker.is_match(&line.text) {
                return Err(
                    "Lyric text resembles LRC timing syntax; export would be ambiguous".into(),
                );
            }
            if line.end_ms.is_some() || line.words.iter().any(|w| w.end_ms.is_some()) {
                warnings.push(
                    "Explicit end times omitted; this exporter writes start markers only".into(),
                );
            }
            if !line.extra.is_empty() || line.words.iter().any(|w| !w.extra.is_empty()) {
                warnings.push("Line/word extensions omitted".into());
            }
            let text = if enhanced && !line.words.is_empty() {
                if line
                    .words
                    .iter()
                    .map(|w| w.text.as_str())
                    .collect::<String>()
                    != line.text
                {
                    return Err("Cannot export inconsistent word text as E-LRC".into());
                }
                if line.words.windows(2).any(|w| w[0].start_ms > w[1].start_ms) {
                    return Err("Cannot export unordered word markers".into());
                }
                line.words
                    .iter()
                    .map(|w| format!("<{}>{}", timestamp(w.start_ms), w.text))
                    .collect::<String>()
            } else {
                if !line.words.is_empty() {
                    warnings.push(
                        "Word timing omitted in normal LRC; use enhanced=true to retain starts"
                            .into(),
                    );
                }
                line.text.clone()
            };
            rows.push(format!("[{}]{text}", timestamp(line.start_ms)));
        }
    }
    warnings.sort();
    warnings.dedup();
    Ok(Conversion {
        output: rows.join("\n") + "\n",
        warnings,
    })
}

pub fn dispatch(request: Value) -> Result<Value, String> {
    match request["op"].as_str().unwrap_or("") {
        "from_lrc" => {
            let options: ImportOptions = serde_json::from_value(
                request
                    .get("options")
                    .cloned()
                    .unwrap_or(serde_json::json!({})),
            )
            .map_err(|e| e.to_string())?;
            let result = from_lrc(
                request["source"]
                    .as_str()
                    .ok_or("source must be a string")?,
                &options,
            )?;
            let yaml = lyricsfile::to_yaml(&result.output)?;
            Ok(
                serde_json::json!({"document": result.output, "yaml": yaml, "warnings": result.warnings}),
            )
        }
        "to_lrc" => {
            let doc = if let Some(source) = request["source"].as_str() {
                lyricsfile::from_yaml(source)?
            } else {
                serde_json::from_value(request["document"].clone()).map_err(|e| e.to_string())?
            };
            Ok(serde_json::to_value(to_lrc(
                &doc,
                request["enhanced"].as_bool().unwrap_or(false),
            )?)
            .unwrap())
        }
        _ => Err("Unknown operation".into()),
    }
}

mod ffi;
