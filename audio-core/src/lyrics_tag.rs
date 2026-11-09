//! Application-independent Lyricsfile embedding proposal. MP4 freeform atoms require a namespace.
use super::*;
use lofty::{
    id3::v2::{ExtendedTextFrame, Frame, Id3v2Tag},
    mp4::{Atom, AtomData, AtomIdent, Ilst},
    ogg::tag::VorbisComments,
    TextEncoding,
};
pub const NAME: &str = "LYRICSFILE";
pub const MP4_MEAN: &str = "org.lyricsfile";
pub fn canonical_opaque(kind: FileType, entry: &str) -> bool {
    let prefix = match kind {
        FileType::Mpeg => "TXXX:LYRICSFILE:",
        FileType::Flac => "LYRICSFILE:",
        FileType::Mp4 => "----:org.lyricsfile:LYRICSFILE:",
        _ => return false,
    };
    entry
        .get(..prefix.len())
        .is_some_and(|s| s.eq_ignore_ascii_case(prefix))
}
pub fn texts(bytes: &[u8], kind: FileType) -> Result<Vec<String>, String> {
    let mut out = vec![];
    match kind {
        FileType::Mpeg => {
            let f =
                lofty::mpeg::MpegFile::read_from(&mut Cursor::new(bytes), ParseOptions::default())
                    .map_err(err)?;
            if let Some(tag) = f.id3v2() {
                for frame in tag {
                    if let Frame::UserText(t) = frame {
                        if t.description.eq_ignore_ascii_case(NAME) {
                            out.push(t.content.to_string());
                        }
                    }
                }
            }
        }
        FileType::Flac => {
            let f =
                lofty::flac::FlacFile::read_from(&mut Cursor::new(bytes), ParseOptions::default())
                    .map_err(err)?;
            if let Some(tag) = f.vorbis_comments() {
                out.extend(
                    tag.items()
                        .filter(|(k, _)| k.eq_ignore_ascii_case(NAME))
                        .map(|(_, v)| v.to_string()),
                );
            }
        }
        FileType::Mp4 => {
            let f =
                lofty::mp4::Mp4File::read_from(&mut Cursor::new(bytes), ParseOptions::default())
                    .map_err(err)?;
            if let Some(tag) = f.ilst() {
                for atom in tag {
                    if let AtomIdent::Freeform { mean, name } = atom.ident() {
                        if mean == MP4_MEAN && name.eq_ignore_ascii_case(NAME) {
                            for data in atom.data() {
                                match data {
                                    AtomData::UTF8(s) | AtomData::UTF16(s) => out.push(s.clone()),
                                    _ => return Err("Das vorhandene LYRICSFILE-Feld enthält binäre Daten und wird nicht ersetzt.".into()),
                                }
                            }
                        }
                    }
                }
            }
        }
        _ => return Err("Nicht unterstütztes Audioformat".into()),
    }
    Ok(out)
}
pub fn write(bytes: Vec<u8>, kind: FileType, text: &str) -> Result<Vec<u8>, String> {
    if text.trim().is_empty() || text.contains('\0') || text.len() > 2 * 1024 * 1024 {
        return Err("Lyricsfile muss nichtleer, ohne NUL und höchstens 2 MiB groß sein.".into());
    }
    if texts(&bytes, kind)?.len() > 1 {
        return Err("Mehrere LYRICSFILE-Einträge vorhanden. Zum Schutz der Varianten wird das Einbetten abgebrochen; bitte eine Begleitdatei exportieren.".into());
    }
    let mut cursor = Cursor::new(bytes);
    match kind {
        FileType::Mpeg => {
            let mut f = lofty::mpeg::MpegFile::read_from(&mut cursor, ParseOptions::default())
                .map_err(err)?;
            if f.id3v2().is_none() {
                f.set_id3v2(Id3v2Tag::new());
            }
            let tag = f.id3v2_mut().unwrap();
            tag.retain(
                |f| !matches!(f,Frame::UserText(t) if t.description.eq_ignore_ascii_case(NAME)),
            );
            tag.insert(Frame::UserText(ExtendedTextFrame::new(
                TextEncoding::UTF8,
                NAME,
                text.to_owned(),
            )));
            cursor.set_position(0);
            f.save_to(&mut cursor, WriteOptions::default())
                .map_err(err)?;
        }
        FileType::Flac => {
            let mut f = lofty::flac::FlacFile::read_from(&mut cursor, ParseOptions::default())
                .map_err(err)?;
            if f.vorbis_comments().is_none() {
                f.set_vorbis_comments(VorbisComments::new());
            }
            f.vorbis_comments_mut()
                .unwrap()
                .insert(NAME.into(), text.into());
            cursor.set_position(0);
            f.save_to(&mut cursor, WriteOptions::default())
                .map_err(err)?;
        }
        FileType::Mp4 => {
            let mut f = lofty::mp4::Mp4File::read_from(&mut cursor, ParseOptions::default())
                .map_err(err)?;
            if f.ilst().is_none() {
                f.set_ilst(Ilst::new());
            }
            let tag = f.ilst_mut().unwrap();
            tag.retain(|atom|!matches!(atom.ident(),AtomIdent::Freeform{mean,name} if mean==MP4_MEAN && name.eq_ignore_ascii_case(NAME)));
            tag.insert(Atom::new(
                AtomIdent::Freeform {
                    mean: MP4_MEAN.into(),
                    name: NAME.into(),
                },
                AtomData::UTF8(text.into()),
            ));
            cursor.set_position(0);
            f.save_to(&mut cursor, WriteOptions::default())
                .map_err(err)?;
        }
        _ => return Err("Nicht unterstütztes Audioformat".into()),
    }
    Ok(cursor.into_inner())
}
