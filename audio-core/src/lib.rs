//! Lossless metadata editing. The same implementation runs in the browser and desktop WebView.
use base64::{engine::general_purpose::STANDARD, Engine};
use lofty::{
    config::{ParseOptions, WriteOptions},
    file::{AudioFile, FileType, TaggedFile, TaggedFileExt},
    picture::{Picture, PictureType},
    probe::Probe,
    tag::{ItemKey, ItemValue, Tag, TagExt, TagItem, TagType},
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::Cursor;
use wasm_bindgen::prelude::*;
mod lyrics_tag;
const LIMIT: usize = 64 * 1024 * 1024;
#[derive(Serialize)]
pub struct Entry {
    pub id: String,
    pub key: String,
    pub text: Option<String>,
    pub language: String,
    pub description: String,
}
#[derive(Serialize)]
pub struct Cover {
    pub id: String,
    pub kind: String,
    pub description: String,
    pub mime: String,
    pub data: Option<String>,
    pub bytes: usize,
}
#[derive(Serialize)]
pub struct Embedded {
    pub label: String,
    pub text: String,
    pub format: String,
}
#[derive(Serialize)]
pub struct Info {
    pub sources: Vec<Embedded>,
    pub format: String,
    pub duration_ms: u128,
    pub sample_rate: Option<u32>,
    pub channels: Option<u8>,
    pub tags: Vec<Entry>,
    pub covers: Vec<Cover>,
    pub payload_sha256: String,
    pub warnings: Vec<String>,
}
#[derive(Deserialize, Default)]
pub struct Patch {
    #[serde(default)]
    pub fields: Vec<Field>,
    #[serde(default)]
    pub covers: Vec<CoverEdit>,
    pub plain: Option<String>,
    /// Stable ID of the exact standard lyrics entry to replace; absent means first primary entry.
    pub lyrics_target: Option<String>,
    pub lyricsfile: Option<String>,
}
#[derive(Deserialize)]
pub struct Field {
    pub id: String,
    pub value: Option<String>,
}
#[derive(Deserialize)]
pub struct CoverEdit {
    pub id: Option<String>,
    pub data: Option<String>,
}
fn read(bytes: &[u8]) -> Result<TaggedFile, String> {
    if bytes.len() > LIMIT {
        return Err("Audio-Dateien sind derzeit auf 64 MiB begrenzt.".into());
    }
    let file = Probe::new(Cursor::new(bytes))
        .guess_file_type()
        .map_err(err)?
        .read()
        .map_err(err)?;
    if !matches!(
        file.file_type(),
        FileType::Mpeg | FileType::Flac | FileType::Mp4
    ) {
        return Err("Unterstützt werden MP3, FLAC und M4A.".into());
    }
    if file.file_type() == FileType::Mp4 {
        let mp4 = lofty::mp4::Mp4File::read_from(&mut Cursor::new(bytes), ParseOptions::default())
            .map_err(err)?;
        if mp4.properties().codec() != Some(lofty::mp4::Mp4Codec::AAC) {
            return Err("M4A unterstützt derzeit AAC; dieser Codec wird nicht bearbeitet.".into());
        }
    }
    Ok(file)
}
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
fn hex(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
// Hash only compressed audio, excluding metadata blocks and mutable MP4 chunk offsets.
pub fn payload(bytes: &[u8], kind: FileType) -> Result<String, String> {
    let mut hash = Sha256::new();
    match kind {
        FileType::Flac => {
            let mut p = id3_end(bytes)?;
            if bytes.get(p..p + 4) != Some(b"fLaC") {
                return Err("Ungültiger FLAC-Header".into());
            }
            p += 4;
            loop {
                let h = bytes.get(p..p + 4).ok_or("Abgeschnittene FLAC-Metadaten")?;
                let last = h[0] & 128 != 0;
                let len = ((h[1] as usize) << 16) | ((h[2] as usize) << 8) | h[3] as usize;
                p = p
                    .checked_add(4 + len)
                    .filter(|v| *v <= bytes.len())
                    .ok_or("Ungültige FLAC-Länge")?;
                if last {
                    break;
                }
            }
            hash.update(&bytes[p..]);
        }
        FileType::Mpeg => {
            let start = id3_end(bytes)?;
            let mut end = bytes.len();
            if end >= 128 && bytes.get(end - 128..end - 125) == Some(b"TAG") {
                end -= 128;
            }
            if end >= 32 && bytes.get(end - 32..end - 24) == Some(b"APETAGEX") {
                let n = u32::from_le_bytes(bytes[end - 20..end - 16].try_into().unwrap()) as usize;
                end = end.checked_sub(n).ok_or("Ungültiger APE-Tag")?;
                if end >= 32 && bytes.get(end - 32..end - 24) == Some(b"APETAGEX") {
                    end -= 32;
                }
            }
            if end <= start {
                return Err("Kein MPEG-Audiostrom".into());
            }
            hash.update(&bytes[start..end]);
        }
        FileType::Mp4 => {
            let mut p = 0usize;
            let mut found = false;
            while p < bytes.len() {
                let h = bytes.get(p..p + 8).ok_or("Abgeschnittene MP4-Box")?;
                let size = u32::from_be_bytes(h[..4].try_into().unwrap());
                let mut head = 8;
                let len = if size == 1 {
                    head = 16;
                    usize::try_from(u64::from_be_bytes(
                        bytes
                            .get(p + 8..p + 16)
                            .ok_or("MP4-Größe fehlt")?
                            .try_into()
                            .unwrap(),
                    ))
                    .map_err(err)?
                } else if size == 0 {
                    bytes.len() - p
                } else {
                    size as usize
                };
                let end = p
                    .checked_add(len)
                    .filter(|v| *v <= bytes.len() && len >= head)
                    .ok_or("Ungültige MP4-Boxlänge")?;
                if &h[4..8] == b"mdat" {
                    hash.update(&bytes[p + head..end]);
                    found = true;
                }
                p = end;
            }
            if !found {
                return Err("Kein MP4-Audiostrom".into());
            }
        }
        _ => return Err("Nicht unterstützter Audiotyp".into()),
    }
    Ok(format!("{:x}", hash.finalize()))
}
fn id3_end(b: &[u8]) -> Result<usize, String> {
    if b.get(..3) != Some(b"ID3") {
        return Ok(0);
    }
    let h = b.get(..10).ok_or("Abgeschnittener ID3-Header")?;
    if h[6..10].iter().any(|v| v & 128 != 0) {
        return Err("Ungültige ID3-Größe".into());
    }
    let n = h[6..10].iter().fold(0usize, |a, b| (a << 7) | *b as usize)
        + 10
        + if h[3] == 4 && h[5] & 16 != 0 { 10 } else { 0 };
    if n > b.len() {
        return Err("Abgeschnittener ID3-Tag".into());
    }
    Ok(n)
}
fn snapshot(file: &TaggedFile, bytes: &[u8]) -> Result<Info, String> {
    let mut tags = vec![];
    let mut covers = vec![];
    for (t, tag) in file.tags().iter().enumerate() {
        for (i, item) in tag.items().enumerate() {
            tags.push(Entry {
                id: format!("{t}:{i}"),
                key: format!("{:?}", item.key()),
                text: match item.value() {
                    ItemValue::Text(s) | ItemValue::Locator(s) => Some(s.clone()),
                    _ => None,
                },
                language: String::from_utf8_lossy(item.lang()).into(),
                description: item.description().into(),
            });
        }
        for (i, p) in tag.pictures().iter().enumerate() {
            covers.push(Cover {
                id: format!("{t}:{i}"),
                kind: format!("{:?}", p.pic_type()),
                description: p.description().unwrap_or("").into(),
                mime: p.mime_type().map(|m| m.to_string()).unwrap_or_default(),
                data: if p.data().len() <= 8 * 1024 * 1024 {
                    Some(STANDARD.encode(p.data()))
                } else {
                    None
                },
                bytes: p.data().len(),
            });
        }
    }
    let (sources, warnings) = embedded(bytes, file.file_type())?;
    Ok(Info {
        sources,
        format: format!("{:?}", file.file_type()),
        duration_ms: file.properties().duration().as_millis(),
        sample_rate: file.properties().sample_rate(),
        channels: file.properties().channels(),
        tags,
        covers,
        payload_sha256: payload(bytes, file.file_type())?,
        warnings,
    })
}
// Recognized custom Lyricsfile fields are read without claiming they are a standard.
fn embedded(bytes: &[u8], kind: FileType) -> Result<(Vec<Embedded>, Vec<String>), String> {
    let mut sources = vec![];
    let mut warnings = vec![];
    if kind == FileType::Mpeg {
        use lofty::id3::v2::{Frame, SynchronizedTextFrame, TimestampFormat};
        let mpeg =
            lofty::mpeg::MpegFile::read_from(&mut Cursor::new(bytes), ParseOptions::default())
                .map_err(err)?;
        if let Some(tag) = mpeg.id3v2() {
            for (i, f) in tag.into_iter().enumerate() {
                match f {
            Frame::UserText(t) if t.description.to_ascii_lowercase().contains("lyricsfile") => sources.push(Embedded{label:format!("TXXX:{} (Erweiterung)",t.description),text:t.content.to_string(),format:"lyricsfile".into()}),
            Frame::Binary(b) if f.id_str()=="SYLT" => match SynchronizedTextFrame::parse(&b.data,b.flags()) {
                Ok(sync) if sync.timestamp_format==TimestampFormat::MS => {
                    // Each segment retains its exact text and millisecond timestamp. Explicit newlines alone split lines.
                    let mut lines=vec![];let mut words=vec![];let mut text=String::new();let mut start=0;
                    for (time,segment) in sync.content {for (part_index,part) in segment.split('\n').enumerate(){
                        if part_index>0 && !words.is_empty(){lines.push(serde_json::json!({"start_ms":start,"text":text,"words":words}));words.clear();text.clear();}
                        if !part.is_empty(){if words.is_empty(){start=time;}text.push_str(part);words.push(serde_json::json!({"start_ms":time,"text":part}));}
                    }}
                    if !words.is_empty(){lines.push(serde_json::json!({"start_ms":start,"text":text,"words":words}));}
                    let doc=serde_json::json!({"version":"1.0","metadata":{"title":"","artist":"","language":String::from_utf8_lossy(&sync.language)},"lines":lines});
                    sources.push(Embedded{label:format!("SYLT #{i} · {} · {}",String::from_utf8_lossy(&sync.language),sync.description.unwrap_or_default()),text:doc.to_string(),format:"lyricsfile".into()});
                    warnings.push("SYLT wird als eigener Entwurf gelesen. Vorhandene Segmente bleiben erhalten; SYLT wird beim Audio-Export unverändert übernommen.".into());
                },Ok(_)=>warnings.push("SYLT mit MPEG-Frame-Zeiten bleibt erhalten; für die Vorschau werden diese Zeiten nicht geraten.".into()),Err(e)=>warnings.push(format!("SYLT konnte nicht interpretiert werden und bleibt erhalten: {e}"))
            }, _=>{}
        }
            }
        }
    } else if kind == FileType::Flac {
        let flac =
            lofty::flac::FlacFile::read_from(&mut Cursor::new(bytes), ParseOptions::default())
                .map_err(err)?;
        if let Some(tag) = flac.vorbis_comments() {
            for (key, value) in tag.items() {
                if key.to_ascii_lowercase().contains("lyricsfile") {
                    sources.push(Embedded {
                        label: format!("{key} (Erweiterung)"),
                        text: value.into(),
                        format: "lyricsfile".into(),
                    });
                }
            }
        }
    } else if kind == FileType::Mp4 {
        use lofty::mp4::{AtomData, AtomIdent};
        let mp4 = lofty::mp4::Mp4File::read_from(&mut Cursor::new(bytes), ParseOptions::default())
            .map_err(err)?;
        if let Some(tag) = mp4.ilst() {
            for atom in tag {
                if let AtomIdent::Freeform { mean, name } = atom.ident() {
                    if name.to_ascii_lowercase().contains("lyricsfile") {
                        for data in atom.data() {
                            if let AtomData::UTF8(text) | AtomData::UTF16(text) = data {
                                sources.push(Embedded {
                                    label: format!("{mean}:{name} (Erweiterung)"),
                                    text: text.clone(),
                                    format: "lyricsfile".into(),
                                });
                            }
                        }
                    }
                }
            }
        }
    }
    Ok((sources, warnings))
}
pub fn inspect_bytes(bytes: &[u8]) -> Result<Info, String> {
    snapshot(&read(bytes)?, bytes)
}
fn parse_id(id: &str) -> Result<(usize, usize), String> {
    let (a, b) = id.split_once(':').ok_or("Ungültige Eintrags-ID")?;
    Ok((a.parse().map_err(err)?, b.parse().map_err(err)?))
}
fn signatures(file: &TaggedFile) -> Vec<String> {
    let mut out = vec![];
    for tag in file.tags() {
        for item in tag.items() {
            out.push(format!(
                "{:?}|{:?}|{:?}|{}|{:?}",
                tag.tag_type(),
                item.key(),
                item.lang(),
                item.description(),
                item.value()
            ));
        }
        for p in tag.pictures() {
            out.push(format!(
                "{:?}|{:?}|{}|{}",
                tag.tag_type(),
                p.pic_type(),
                p.description().unwrap_or(""),
                hex(p.data())
            ));
        }
    }
    out.sort();
    out
}
// Unmapped items live in Lofty's format-specific companion tags, outside Tag::items().
// Verify them separately so generic read-back cannot hide a dropped extension or SYLT frame.
fn opaque(bytes: &[u8], kind: FileType) -> Result<Vec<String>, String> {
    use lofty::tag::TagType;
    let mut out = vec![];
    if kind == FileType::Mpeg {
        use lofty::id3::v2::Frame;
        let f = lofty::mpeg::MpegFile::read_from(&mut Cursor::new(bytes), ParseOptions::default())
            .map_err(err)?;
        if let Some(tag) = f.id3v2() {
            for frame in tag {
                match frame {
                    Frame::Binary(b) => out.push(format!("{}:{}", frame.id_str(), hex(&b.data))),
                    Frame::UserText(t)
                        if ItemKey::from_key(TagType::Id3v2, &t.description).is_none() =>
                    {
                        out.push(format!("TXXX:{}:{}", t.description, t.content))
                    }
                    Frame::UserUrl(t)
                        if ItemKey::from_key(TagType::Id3v2, &t.description).is_none() =>
                    {
                        out.push(format!("WXXX:{t:?}"))
                    }
                    Frame::Private(p) => {
                        out.push(format!("PRIV:{}:{}", p.owner, hex(&p.private_data)))
                    }
                    _ => {}
                }
            }
        }
    } else if kind == FileType::Flac {
        let f = lofty::flac::FlacFile::read_from(&mut Cursor::new(bytes), ParseOptions::default())
            .map_err(err)?;
        if let Some(tag) = f.vorbis_comments() {
            for (key, value) in tag.items() {
                if ItemKey::from_key(TagType::VorbisComments, key).is_none() {
                    out.push(format!("{key}:{value}"));
                }
            }
        }
    } else if kind == FileType::Mp4 {
        use lofty::mp4::AtomIdent;
        let f = lofty::mp4::Mp4File::read_from(&mut Cursor::new(bytes), ParseOptions::default())
            .map_err(err)?;
        if let Some(tag) = f.ilst() {
            for atom in tag {
                if let AtomIdent::Freeform { mean, name } = atom.ident() {
                    let key = format!("----:{mean}:{name}");
                    if ItemKey::from_key(TagType::Mp4Ilst, &key).is_none() {
                        out.push(format!("{key}:{:?}", atom.data().collect::<Vec<_>>()));
                    }
                }
            }
        }
    }
    out.sort();
    Ok(out)
}
fn text_value(key: ItemKey, value: &str) -> Result<String, String> {
    if matches!(
        key,
        ItemKey::TrackNumber | ItemKey::TrackTotal | ItemKey::DiscNumber | ItemKey::DiscTotal
    ) {
        value
            .trim()
            .parse::<u16>()
            .map(|v| v.to_string())
            .map_err(|_| {
                "Track- und Disc-Nummern müssen ganze Zahlen zwischen 0 und 65535 sein.".into()
            })
    } else {
        Ok(value.into())
    }
}
pub fn edit_bytes(bytes: &[u8], patch: Patch) -> Result<Vec<u8>, String> {
    let mut file = read(bytes)?;
    let before = payload(bytes, file.file_type())?;
    let lengths: Vec<usize> = file.tags().iter().map(|tag| tag.items().len()).collect();
    for f in patch.fields.iter().filter(|f| !f.id.starts_with('@')) {
        let (t, i) = parse_id(&f.id)?;
        if lengths.get(t).is_none_or(|n| i >= *n) {
            return Err("Unbekannte Tag-ID".into());
        }
    }
    let lyrics_target = patch.lyrics_target.as_deref().map(parse_id).transpose()?;
    if let Some((t, i)) = lyrics_target {
        let target = file
            .tags()
            .get(t)
            .and_then(|tag| tag.items().nth(i))
            .ok_or("Lyrics-Eintrag fehlt")?;
        if patch.plain.is_none() || !matches!(target.key(), ItemKey::Lyrics | ItemKey::UnsyncLyrics)
        {
            return Err("Ungültiges Standard-Lyrics-Ziel".into());
        }
        if patch
            .fields
            .iter()
            .any(|f| Some(f.id.as_str()) == patch.lyrics_target.as_deref())
        {
            return Err("Lyrics-Ziel wird doppelt bearbeitet".into());
        }
    }
    // Stable IDs refer to the immutable source. Rebuild each tag once, preserving duplicate entries.
    for (t, tag_type) in file
        .tags()
        .iter()
        .map(|t| t.tag_type())
        .collect::<Vec<_>>()
        .into_iter()
        .enumerate()
    {
        let tag = file.tag_mut(tag_type).ok_or("Tag fehlt")?;
        let mut items = vec![];
        for (i, item) in tag.items().enumerate() {
            if lyrics_target == Some((t, i)) {
                let mut new = TagItem::new(
                    item.key(),
                    ItemValue::Text(patch.plain.as_ref().unwrap().clone()),
                );
                new.set_lang(*item.lang());
                new.set_description(item.description().into());
                items.push(new);
                continue;
            }
            if let Some(field) = patch.fields.iter().find(|f| f.id == format!("{t}:{i}")) {
                if !matches!(item.value(), ItemValue::Text(_) | ItemValue::Locator(_)) {
                    return Err("Binäre Tags sind schreibgeschützt".into());
                }
                if let Some(value) = &field.value {
                    let mut new = TagItem::new(
                        item.key(),
                        match item.value() {
                            ItemValue::Locator(_) => ItemValue::Locator(value.clone()),
                            _ => ItemValue::Text(text_value(item.key(), value)?),
                        },
                    );
                    new.set_lang(*item.lang());
                    new.set_description(item.description().into());
                    items.push(new);
                }
            } else {
                items.push(item.clone());
            }
        }
        tag.retain(|_| false);
        for item in items {
            tag.push_unchecked(item);
        }
    }
    let primary = file.primary_tag_type();
    if file.primary_tag().is_none() {
        file.insert_tag(Tag::new(primary));
    }
    if let Some(text) = patch.plain.filter(|_| patch.lyrics_target.is_none()) {
        let key = if file.file_type() == FileType::Mpeg {
            ItemKey::UnsyncLyrics
        } else {
            ItemKey::Lyrics
        };
        let tag = file.primary_tag_mut().unwrap();
        let mut replaced = false;
        let mut items = vec![];
        for item in tag.items() {
            if !replaced && item.key() == key {
                let mut new = TagItem::new(key, ItemValue::Text(text.clone()));
                new.set_lang(*item.lang());
                new.set_description(item.description().into());
                items.push(new);
                replaced = true;
            } else {
                items.push(item.clone());
            }
        }
        if !replaced {
            items.push(TagItem::new(key, ItemValue::Text(text)));
        }
        tag.retain(|_| false);
        for item in items {
            tag.push_unchecked(item);
        }
    }
    for field in patch.fields.iter().filter(|f| f.id.starts_with('@')) {
        let key = match field.id.as_str() {
            "@TrackTitle" => ItemKey::TrackTitle,
            "@TrackArtist" => ItemKey::TrackArtist,
            "@AlbumTitle" => ItemKey::AlbumTitle,
            "@AlbumArtist" => ItemKey::AlbumArtist,
            "@TrackNumber" => ItemKey::TrackNumber,
            "@DiscNumber" => ItemKey::DiscNumber,
            "@RecordingDate" => ItemKey::RecordingDate,
            "@Genre" => ItemKey::Genre,
            _ => return Err("Unbekannter Tag-Schlüssel".into()),
        };
        if let Some(value) = &field.value {
            file.primary_tag_mut()
                .unwrap()
                .insert_text(key, text_value(key, value)?);
        }
    }
    // Replace before deleting, then descending indices prevent shifts.
    let is_mp4 = file.file_type() == FileType::Mp4;
    let is_mp3 = file.file_type() == FileType::Mpeg;
    let types = file.tags().iter().map(|t| t.tag_type()).collect::<Vec<_>>();
    let mut removals = vec![];
    for edit in patch.covers {
        let picture = if let Some(data) = edit.data {
            let data = STANDARD.decode(data).map_err(err)?;
            if data.len() > 8 * 1024 * 1024 {
                return Err("Cover darf höchstens 8 MiB groß sein".into());
            }
            if !data.starts_with(b"\x89PNG\r\n\x1a\n") && !data.starts_with(b"\xff\xd8\xff") {
                return Err("Cover muss PNG oder JPEG sein".into());
            }
            Some(Picture::from_reader(&mut Cursor::new(data)).map_err(err)?)
        } else {
            None
        };
        if let Some(id) = edit.id {
            let (t, i) = parse_id(&id)?;
            let tag = file
                .tag_mut(*types.get(t).ok_or("Cover-Tag fehlt")?)
                .ok_or("Cover-Tag fehlt")?;
            let old = tag.pictures().get(i).ok_or("Cover fehlt")?.clone();
            if let Some(mut p) = picture {
                p.set_pic_type(old.pic_type());
                p.set_description(old.description().map(Into::into));
                tag.set_picture(i, p);
            } else {
                removals.push((t, i));
            }
        } else if let Some(mut p) = picture {
            p.set_pic_type(if is_mp4 {
                PictureType::Other
            } else {
                PictureType::CoverFront
            });
            if is_mp3 {
                let n = file.primary_tag().unwrap().pictures().len();
                p.set_description(Some(format!("Verso cover {}", n + 1)));
            }
            file.primary_tag_mut().unwrap().push_picture(p);
        }
    }
    removals.sort_unstable();
    for (t, i) in removals.into_iter().rev() {
        file.tag_mut(types[t]).unwrap().remove_picture(i);
    }
    let opaque_before = opaque(bytes, file.file_type())?;
    let expected = signatures(&file);
    let mut output = Cursor::new(bytes.to_vec());
    if file.file_type() == FileType::Flac {
        // Lofty's borrowed FLAC writer omits unknown Vorbis companion items.
        // Use its owned merge conversion so LYRICSFILE and other custom comments survive.
        for tag in file.tags() {
            output.set_position(0);
            if tag.tag_type() == TagType::VorbisComments {
                let comments: lofty::ogg::tag::VorbisComments = tag.clone().into();
                comments
                    .save_to(&mut output, WriteOptions::default())
                    .map_err(err)?;
            } else {
                tag.save_to(&mut output, WriteOptions::default())
                    .map_err(err)?;
            }
        }
    } else {
        file.save_to(&mut output, WriteOptions::default())
            .map_err(err)?;
    }
    let output = output.into_inner();
    let after = read(&output)?;
    if payload(&output, after.file_type())? != before {
        return Err("Speichern abgebrochen: Audiostrom hat sich geändert".into());
    }
    if opaque(&output, after.file_type())? != opaque_before {
        return Err("Speichern abgebrochen: Ein freies oder binäres Tag wurde verändert".into());
    }
    if signatures(&after) != expected {
        return Err("Speichern abgebrochen: Tags oder Bilder haben den Schreib-Lese-Test nicht unverändert bestanden".into());
    }
    if let Some(text) = patch.lyricsfile {
        let kind = after.file_type();
        let mut opaque_expected = opaque(&output, kind)?;
        opaque_expected.retain(|entry| !lyrics_tag::canonical_opaque(kind, entry));
        let output = lyrics_tag::write(output, kind, &text)?;
        let tagged = read(&output)?;
        let mut opaque_after = opaque(&output, kind)?;
        opaque_after.retain(|entry| !lyrics_tag::canonical_opaque(kind, entry));
        if payload(&output, kind)? != before
            || signatures(&tagged) != expected
            || opaque_after != opaque_expected
            || lyrics_tag::texts(&output, kind)? != vec![text]
        {
            return Err("Speichern abgebrochen: Lyricsfile-Einbettung hat die Erhaltungsprüfung nicht bestanden".into());
        }
        return Ok(output);
    }
    Ok(output)
}
#[wasm_bindgen]
pub fn inspect(bytes: &[u8]) -> Result<String, JsValue> {
    inspect_bytes(bytes)
        .and_then(|i| serde_json::to_string(&i).map_err(err))
        .map_err(|e| JsValue::from_str(&e))
}
#[wasm_bindgen]
pub fn edit(bytes: &[u8], patch: &str) -> Result<Vec<u8>, JsValue> {
    let p = serde_json::from_str(patch).map_err(|e| JsValue::from_str(&e.to_string()))?;
    edit_bytes(bytes, p).map_err(|e| JsValue::from_str(&e))
}
