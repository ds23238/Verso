//! Lyricsfile 1.0 draft model. Unknown fields survive read/write operations.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

pub const MAX_BYTES: usize = 2 * 1024 * 1024;
pub type Extensions = BTreeMap<String, Value>;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Document {
    pub version: String,
    pub metadata: Metadata,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub lines: Vec<Line>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub plain: Option<String>,
    #[serde(flatten)]
    pub extra: Extensions,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
pub struct Metadata {
    pub title: String,
    pub artist: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub album: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offset_ms: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub instrumental: bool,
    #[serde(flatten)]
    pub extra: Extensions,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Line {
    pub text: String,
    pub start_ms: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_ms: Option<i64>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub words: Vec<Word>,
    #[serde(flatten)]
    pub extra: Extensions,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Word {
    pub text: String,
    pub start_ms: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_ms: Option<i64>,
    #[serde(flatten)]
    pub extra: Extensions,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Diagnostic {
    pub severity: String,
    pub path: String,
    pub message: String,
}

fn issue(out: &mut Vec<Diagnostic>, severity: &str, path: &str, message: &str) {
    out.push(Diagnostic {
        severity: severity.into(),
        path: path.into(),
        message: message.into(),
    });
}

fn timing(out: &mut Vec<Diagnostic>, path: &str, start: i64, end: Option<i64>) {
    if start < 0 {
        issue(out, "error", path, "start_ms must not be negative");
    }
    if end.is_some_and(|end| end < start) {
        issue(out, "error", path, "end_ms precedes start_ms");
    }
}

pub fn validate(doc: &Document) -> Vec<Diagnostic> {
    let mut out = vec![];
    fn reserved(out: &mut Vec<Diagnostic>, extra: &Extensions, keys: &[&str], path: &str) {
        if extra.keys().any(|k| keys.contains(&k.as_str())) {
            issue(
                out,
                "error",
                path,
                "Extension fields collide with reserved keys",
            );
        }
    }
    reserved(
        &mut out,
        &doc.extra,
        &["version", "metadata", "lines", "plain"],
        "$",
    );
    reserved(
        &mut out,
        &doc.metadata.extra,
        &[
            "title",
            "artist",
            "album",
            "duration_ms",
            "offset_ms",
            "language",
            "instrumental",
        ],
        "metadata",
    );
    if doc.version != "1.0" {
        issue(
            &mut out,
            "error",
            "version",
            "Unsupported version; expected string 1.0",
        );
    }
    if doc.metadata.duration_ms.is_some_and(|v| v < 0) {
        issue(
            &mut out,
            "error",
            "metadata.duration_ms",
            "Duration must not be negative",
        );
    }
    if doc.metadata.offset_ms.is_some() {
        issue(
            &mut out,
            "warning",
            "metadata.offset_ms",
            "Offset semantics are unresolved; no implicit adjustment",
        );
    }
    if doc.metadata.instrumental
        && (!doc.lines.is_empty() || doc.plain.as_ref().is_some_and(|v| !v.is_empty()))
    {
        issue(
            &mut out,
            "error",
            "metadata.instrumental",
            "Instrumental tracks cannot contain lyrics",
        );
    }
    if !doc.metadata.instrumental
        && doc.lines.is_empty()
        && doc.plain.as_ref().is_none_or(|v| v.is_empty())
    {
        issue(&mut out, "warning", "lines", "No lyrics supplied");
    }
    for (i, line) in doc.lines.iter().enumerate() {
        let path = format!("lines[{i}]");
        reserved(
            &mut out,
            &line.extra,
            &["text", "start_ms", "end_ms", "words"],
            &path,
        );
        timing(&mut out, &path, line.start_ms, line.end_ms);
        if i > 0 && line.start_ms < doc.lines[i - 1].start_ms {
            issue(
                &mut out,
                "warning",
                &path,
                "Lines are not ordered by start_ms",
            );
        }
        if doc
            .metadata
            .duration_ms
            .is_some_and(|d| line.start_ms > d || line.end_ms.is_some_and(|e| e > d))
        {
            issue(&mut out, "warning", &path, "Line timing exceeds duration");
        }
        if !line.words.is_empty()
            && line
                .words
                .iter()
                .map(|w| w.text.as_str())
                .collect::<String>()
                != line.text
        {
            issue(
                &mut out,
                "warning",
                &path,
                "Joined word text differs from line text",
            );
        }
        for (j, word) in line.words.iter().enumerate() {
            let wp = format!("{path}.words[{j}]");
            reserved(&mut out, &word.extra, &["text", "start_ms", "end_ms"], &wp);
            timing(&mut out, &wp, word.start_ms, word.end_ms);
            if j > 0 && word.start_ms < line.words[j - 1].start_ms {
                issue(
                    &mut out,
                    "warning",
                    &wp,
                    "Words are not ordered by start_ms",
                );
            }
            if word.start_ms < line.start_ms
                || line
                    .end_ms
                    .is_some_and(|end| word.start_ms > end || word.end_ms.is_some_and(|e| e > end))
            {
                issue(
                    &mut out,
                    "warning",
                    &wp,
                    "Word timing lies outside line interval",
                );
            }
        }
    }
    // Validate extension values as well: the draft allows no floating-point scalars.
    if let Ok(value) = serde_json::to_value(doc) {
        fn walk(v: &Value, path: &str, out: &mut Vec<Diagnostic>) {
            match v {
                Value::Number(n) if !n.is_i64() && !n.is_u64() => issue(
                    out,
                    "error",
                    path,
                    "Floating-point values are not supported",
                ),
                Value::Array(a) => {
                    for (i, v) in a.iter().enumerate() {
                        walk(v, &format!("{path}[{i}]"), out);
                    }
                }
                Value::Object(m) => {
                    for (k, v) in m {
                        walk(v, &format!("{path}.{k}"), out);
                    }
                }
                _ => {}
            }
        }
        walk(&value, "$", &mut out);
    }
    out
}

pub fn ensure_valid(doc: &Document) -> Result<(), String> {
    let errors: Vec<_> = validate(doc)
        .into_iter()
        .filter(|d| d.severity == "error")
        .collect();
    if errors.is_empty() {
        Ok(())
    } else {
        Err(serde_json::to_string(&errors).unwrap())
    }
}

fn yaml_shape(value: &serde_yaml::Value, depth: usize) -> Result<(), String> {
    use serde_yaml::Value as Y;
    if depth > 64 {
        return Err("YAML nesting exceeds 64 levels".into());
    }
    match value {
        Y::Tagged(_) => return Err("Custom YAML tags are forbidden".into()),
        Y::Number(n) if !n.is_i64() && !n.is_u64() => {
            return Err("Floating-point YAML values are forbidden".into())
        }
        Y::Mapping(m) => {
            for (k, v) in m {
                if !matches!(k, Y::String(_)) {
                    return Err("Mapping keys must be strings".into());
                }
                yaml_shape(v, depth + 1)?;
            }
        }
        Y::Sequence(a) => {
            for v in a {
                yaml_shape(v, depth + 1)?;
            }
        }
        _ => {}
    }
    Ok(())
}

pub fn from_yaml(source: &str) -> Result<Document, String> {
    if source.len() > MAX_BYTES {
        return Err("Document exceeds 2 MiB".into());
    }
    let value: serde_yaml::Value = serde_yaml::from_str(source).map_err(|e| e.to_string())?;
    yaml_shape(&value, 0)?;
    let doc: Document = serde_yaml::from_value(value).map_err(|e| e.to_string())?;
    ensure_valid(&doc)?;
    Ok(doc)
}

pub fn to_yaml(doc: &Document) -> Result<String, String> {
    ensure_valid(doc)?;
    serde_yaml::to_string(doc).map_err(|e| e.to_string())
}

pub fn dispatch(request: Value) -> Result<Value, String> {
    match request["op"].as_str().unwrap_or("") {
        "parse" => {
            let doc = from_yaml(
                request["source"]
                    .as_str()
                    .ok_or("source must be a string")?,
            )?;
            Ok(serde_json::json!({"document": doc, "warnings": validate(&doc)}))
        }
        "stringify" | "validate" => {
            let doc: Document =
                serde_json::from_value(request["document"].clone()).map_err(|e| e.to_string())?;
            if request["op"] == "validate" {
                Ok(serde_json::json!(validate(&doc)))
            } else {
                Ok(serde_json::json!(to_yaml(&doc)?))
            }
        }
        _ => Err("Unknown operation".into()),
    }
}

mod ffi;
