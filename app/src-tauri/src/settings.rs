use std::fs;
use std::path::PathBuf;

use serde_json::{json, Value};

pub const SMOKE: &str = "smoke";
pub const COFFEE: &str = "coffee";

fn settings_path() -> Option<PathBuf> {
    let root = if let Some(d) = std::env::var_os("CENTIK_DIR").filter(|v| !v.is_empty()) {
        PathBuf::from(d)
    } else {
        let key = if cfg!(windows) { "USERPROFILE" } else { "HOME" };
        let home = std::env::var_os(key).filter(|v| !v.is_empty())?;
        PathBuf::from(home).join(".claude").join("usage").join("centik")
    };
    Some(root.join("app.json"))
}

/// Rest style from app.json; anything unknown falls back to "smoke".
pub fn read_rest_style() -> String {
    let style = settings_path()
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|t| serde_json::from_str::<Value>(&t).ok())
        .and_then(|v| v.get("rest_style").and_then(|s| s.as_str()).map(str::to_owned));
    match style.as_deref() {
        Some(COFFEE) => COFFEE.to_owned(),
        _ => SMOKE.to_owned(),
    }
}

/// Atomic write: temp file in the same folder, then rename over the target.
pub fn write_rest_style(style: &str) -> std::io::Result<()> {
    let Some(path) = settings_path() else {
        return Err(std::io::Error::new(std::io::ErrorKind::NotFound, "no home dir"));
    };
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, json!({ "rest_style": style }).to_string())?;
    fs::rename(&tmp, &path)
}

#[tauri::command]
pub fn get_rest_style() -> String {
    read_rest_style()
}
