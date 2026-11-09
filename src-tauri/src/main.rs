#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::fs;
#[derive(serde::Serialize)]
struct OpenedFile {
    name: String,
    content: String,
}
const LIMIT: usize = 2 * 1024 * 1024;
#[tauri::command]
async fn open_lyrics_file() -> Result<Option<OpenedFile>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let Some(path) = rfd::FileDialog::new()
            .add_filter("Lyrics", &["lrc", "yaml", "yml", "txt"])
            .pick_file()
        else {
            return Ok(None);
        };
        if fs::metadata(&path).map_err(|e| e.to_string())?.len() > LIMIT as u64 {
            return Err("Datei ist größer als 2 MiB.".into());
        }
        let bytes = fs::read(&path).map_err(|e| e.to_string())?;
        if bytes.len() > LIMIT {
            return Err("Datei ist größer als 2 MiB.".into());
        }
        let content = String::from_utf8(bytes)
            .map_err(|_| "Die Datei ist nicht gültig UTF-8.".to_string())?;
        Ok(Some(OpenedFile {
            name: path
                .file_name()
                .ok_or("Ungültiger Dateiname")?
                .to_string_lossy()
                .into_owned(),
            content,
        }))
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn save_lyrics_file(name: String, content: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let safe_name = std::path::Path::new(&name)
            .file_name()
            .ok_or("Ungültiger Dateiname")?
            .to_string_lossy();
        let Some(path) = rfd::FileDialog::new()
            .set_file_name(safe_name.as_ref())
            .save_file()
        else {
            return Ok(false);
        };
        fs::write(path, content.as_bytes()).map_err(|e| e.to_string())?;
        Ok(true)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn save_audio_file(name: String, data: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        use base64::Engine;
        use std::io::Write;
        if data.len() > 100 * 1024 * 1024 {
            return Err("Export ist zu groß.".into());
        }
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(data)
            .map_err(|e| e.to_string())?;
        let safe_name = std::path::Path::new(&name)
            .file_name()
            .ok_or("Ungültiger Dateiname")?
            .to_string_lossy();
        let Some(path) = rfd::FileDialog::new()
            .set_file_name(safe_name.as_ref())
            .save_file()
        else {
            return Ok(false);
        };
        let mut temp = tempfile::NamedTempFile::new_in(path.parent().ok_or("Zielordner fehlt")?)
            .map_err(|e| e.to_string())?;
        temp.write_all(&bytes).map_err(|e| e.to_string())?;
        temp.as_file().sync_all().map_err(|e| e.to_string())?;
        temp.persist_noclobber(&path).map_err(|e| e.to_string())?;
        Ok(true)
    })
    .await
    .map_err(|e| e.to_string())?
}
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            open_lyrics_file,
            save_lyrics_file,
            save_audio_file
        ])
        .run(tauri::generate_context!())
        .expect("Verso konnte nicht gestartet werden");
}
