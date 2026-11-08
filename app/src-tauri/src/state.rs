//! Live state: reads the hook/worker/status files (see docs/SOZLESME.md), builds one
//! payload and pushes it to the front end whenever it changes.

use std::fs;
use std::io::{Read, Seek, SeekFrom};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, State};

const STALE_SECS: i64 = 30 * 60;
const DAY_SECS: i64 = 24 * 60 * 60;
const DONE_VISIBLE_SECS: i64 = 60;
const CODEX_REFRESH: Duration = Duration::from_secs(30);
const CODEX_TAIL_BYTES: u64 = 256 * 1024;

/// Last payload sent to the front end (for the initial `get_state` call).
#[derive(Clone)]
pub struct StateStore(Arc<Mutex<Value>>);

impl Default for StateStore {
    fn default() -> Self {
        StateStore(Arc::new(Mutex::new(json!({
            "sessions": [], "claude": null, "codex": null, "age": null
        }))))
    }
}

#[tauri::command]
pub fn get_state(store: State<'_, StateStore>) -> Value {
    match store.0.lock() {
        Ok(v) => v.clone(),
        Err(_) => Value::Null,
    }
}

// ---------- small helpers ----------

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn home_dir() -> Option<PathBuf> {
    let key = if cfg!(windows) { "USERPROFILE" } else { "HOME" };
    std::env::var_os(key).filter(|v| !v.is_empty()).map(PathBuf::from)
}

fn root_dir() -> Option<PathBuf> {
    if let Some(d) = std::env::var_os("CENTIK_DIR").filter(|v| !v.is_empty()) {
        return Some(PathBuf::from(d));
    }
    home_dir().map(|h| h.join(".claude").join("usage").join("centik"))
}

fn read_json(path: &Path) -> Option<Value> {
    let text = fs::read_to_string(path).ok()?;
    serde_json::from_str(&text).ok()
}

fn json_files(dir: &Path) -> Vec<PathBuf> {
    let Ok(rd) = fs::read_dir(dir) else { return Vec::new() };
    rd.filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().and_then(|x| x.to_str()) == Some("json"))
        .collect()
}

fn mtime_secs(path: &Path) -> Option<i64> {
    let m = fs::metadata(path).ok()?.modified().ok()?;
    m.duration_since(UNIX_EPOCH).ok().map(|d| d.as_secs() as i64)
}

fn num(v: &Value, key: &str) -> Option<i64> {
    v.get(key).and_then(Value::as_f64).map(|f| f as i64)
}

fn text<'a>(v: &'a Value, key: &str) -> Option<&'a str> {
    v.get(key).and_then(Value::as_str)
}

/// Case and slash insensitive cwd key.
fn norm_cwd(s: &str) -> String {
    s.replace('\\', "/").trim_end_matches('/').to_lowercase()
}

#[cfg(windows)]
fn pid_alive(pid: u32) -> bool {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{
        GetExitCodeProcess, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION,
    };

    if pid == 0 {
        return false;
    }
    unsafe {
        match OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) {
            Ok(h) => {
                let mut code = 0u32;
                // 259 = STILL_ACTIVE
                let alive = GetExitCodeProcess(h, &mut code).is_ok() && code == 259;
                let _ = CloseHandle(h);
                alive
            }
            // Access denied still means the process exists.
            Err(e) => e.code().0 as u32 == 0x8007_0005,
        }
    }
}

#[cfg(not(windows))]
fn pid_alive(pid: u32) -> bool {
    pid != 0 && Path::new(&format!("/proc/{pid}")).exists()
}

// ---------- sessions + workers ----------

struct Row {
    id: String,
    src: String,
    project: String,
    status: String,
    agents: Vec<String>,
    question: Option<String>,
    turn_started: i64,
    d: i64,
    done_at: i64,
    cwd: String,
    info: Value,
}

fn status_order(st: &str) -> u8 {
    match st {
        "waiting" => 0,
        "busy" => 1,
        "resting" => 2,
        _ => 3,
    }
}

fn read_sessions(root: &Path, now: i64) -> Vec<Row> {
    let mut rows = Vec::new();
    for path in json_files(&root.join("sessions")) {
        let Some(v) = read_json(&path) else { continue };
        let updated = num(&v, "updated").or_else(|| mtime_secs(&path)).unwrap_or(0);
        if now.saturating_sub(updated) > DAY_SECS {
            let _ = fs::remove_file(&path);
            continue;
        }
        let id = text(&v, "id")
            .map(str::to_string)
            .or_else(|| path.file_stem().and_then(|s| s.to_str()).map(str::to_string))
            .unwrap_or_default();
        let status = text(&v, "status").unwrap_or("idle");
        let turn_started = num(&v, "turn_started").unwrap_or(updated);
        let mut done_at = 0;
        match status {
            "busy" | "waiting" | "resting" => {
                let transcript_fresh = text(&v, "transcript")
                    .and_then(|t| mtime_secs(Path::new(t)))
                    .map_or(false, |m| now.saturating_sub(m) <= STALE_SECS);
                if now.saturating_sub(updated) > STALE_SECS && !transcript_fresh {
                    continue;
                }
            }
            "done" => {
                done_at = num(&v, "done_at").unwrap_or(updated);
                if now.saturating_sub(done_at) > DONE_VISIBLE_SECS {
                    continue;
                }
            }
            _ => continue,
        }

        let mut agents: Vec<(i64, String)> = Vec::new();
        if let Some(map) = v.get("agents").and_then(Value::as_object) {
            for a in map.values() {
                let kind = text(a, "kind").unwrap_or("claude").to_string();
                agents.push((num(a, "started").unwrap_or(0), kind));
            }
        }
        agents.sort();

        let end = if status == "done" { done_at } else { now };
        let info = read_json(&root.join("status").join(format!("{id}.json"))).unwrap_or(Value::Null);
        let cwd = text(&v, "cwd").unwrap_or("");
        rows.push(Row {
            project: text(&v, "project").map(str::to_string).unwrap_or_else(|| {
                cwd.replace('\\', "/").rsplit('/').next().unwrap_or("").to_string()
            }),
            id,
            src: text(&v, "source").unwrap_or("claude").to_string(),
            status: status.to_string(),
            agents: agents.into_iter().map(|(_, k)| k).collect(),
            question: text(&v, "question").map(str::to_string),
            turn_started,
            d: (end.saturating_sub(turn_started).max(0)) / 60,
            done_at,
            cwd: norm_cwd(cwd),
            info,
        });
    }
    rows
}

/// Attach live workers to the session with the same cwd; unmatched ones get their own row.
fn merge_workers(root: &Path, now: i64, rows: &mut Vec<Row>) {
    let mut own: Vec<Row> = Vec::new();
    for path in json_files(&root.join("workers")) {
        let Some(v) = read_json(&path) else { continue };
        let pid = num(&v, "pid")
            .or_else(|| path.file_stem().and_then(|s| s.to_str()).and_then(|s| s.parse().ok()))
            .unwrap_or(0);
        if !pid_alive(pid as u32) {
            let _ = fs::remove_file(&path);
            continue;
        }
        let kind = text(&v, "kind").unwrap_or("claude").to_string();
        let cwd_raw = text(&v, "cwd").unwrap_or("");
        let cwd = norm_cwd(cwd_raw);
        let started = num(&v, "started").unwrap_or(now);

        let target = rows
            .iter_mut()
            .find(|r| r.cwd == cwd && matches!(r.status.as_str(), "busy" | "waiting" | "resting"));
        if let Some(r) = target {
            r.agents.push(kind);
        } else if let Some(r) = own.iter_mut().find(|r| r.cwd == cwd) {
            // Several workers in the same folder share one row.
            r.agents.push(kind);
            r.turn_started = r.turn_started.min(started);
            r.d = (now.saturating_sub(r.turn_started)).max(0) / 60;
        } else {
            own.push(Row {
                id: format!("worker-{pid}"),
                src: "claude".into(),
                project: text(&v, "project").map(str::to_string).unwrap_or_else(|| {
                    cwd_raw.replace('\\', "/").rsplit('/').next().unwrap_or("").to_string()
                }),
                status: "resting".into(),
                agents: vec![kind],
                question: None,
                turn_started: started,
                d: (now.saturating_sub(started)).max(0) / 60,
                done_at: 0,
                cwd,
                info: Value::Null,
            });
        }
    }
    rows.extend(own);
}

fn rows_to_json(mut rows: Vec<Row>) -> Value {
    rows.sort_by_key(|r| (status_order(&r.status), r.turn_started));
    Value::Array(
        rows.into_iter()
            .map(|r| {
                let f = |k: &str| r.info.get(k).cloned().unwrap_or(Value::Null);
                json!({
                    "id": r.id,
                    "src": r.src,
                    "p": r.project,
                    "st": r.status,
                    "agents": r.agents,
                    "d": r.d,
                    "q": r.question,
                    "done_at": r.done_at,
                    "model": f("model"),
                    "ctx": f("ctx"),
                    "cost": f("cost"),
                    "added": f("added"),
                    "removed": f("removed"),
                })
            })
            .collect(),
    )
}

// ---------- quotas ----------

/// A window whose reset time has passed counts as empty.
fn window_pct(used: Option<f64>, resets_at: Option<i64>, now: i64) -> i64 {
    match (used, resets_at) {
        (None, _) => 0,
        (Some(_), Some(r)) if r > 0 && r <= now => 0,
        (Some(u), _) => u.round() as i64,
    }
}

fn quota_value(five: &Value, week: &Value, now: i64) -> Value {
    let used = |w: &Value| w.get("used_percent").and_then(Value::as_f64);
    let reset = |w: &Value| w.get("resets_at").and_then(Value::as_f64).map(|f| f as i64);
    json!({
        "p5": window_pct(used(five), reset(five), now),
        "p7": window_pct(used(week), reset(week), now),
        "r5": reset(five).unwrap_or(0),
        "r7": reset(week).unwrap_or(0),
    })
}

/// (quota, age in minutes)
fn read_claude_limits(root: &Path, now: i64) -> (Value, Value) {
    let Some(parent) = root.parent() else { return (Value::Null, Value::Null) };
    let Some(c) = read_json(&parent.join("claude-limits.json")) else {
        return (Value::Null, Value::Null);
    };
    let null = Value::Null;
    let five = c.get("five_hour").unwrap_or(&null);
    let week = c.get("seven_day").unwrap_or(&null);
    if !five.is_object() && !week.is_object() {
        return (Value::Null, Value::Null);
    }
    let age = num(&c, "updated_at").map_or(Value::Null, |u| json!(((now.saturating_sub(u)).max(0)) / 60));
    (quota_value(five, week, now), age)
}

fn sorted_names(dir: &Path) -> Vec<String> {
    let Ok(rd) = fs::read_dir(dir) else { return Vec::new() };
    let mut v: Vec<String> = rd
        .filter_map(|e| e.ok())
        .filter_map(|e| e.file_name().into_string().ok())
        .collect();
    v.sort();
    v.reverse();
    v
}

/// Newest rollout files: walk year/month/day directories in descending order.
fn newest_codex_files(sessions: &Path, limit: usize) -> Vec<PathBuf> {
    let mut out: Vec<(i64, PathBuf)> = Vec::new();
    for y in sorted_names(sessions) {
        for m in sorted_names(&sessions.join(&y)) {
            for d in sorted_names(&sessions.join(&y).join(&m)) {
                let dir = sessions.join(&y).join(&m).join(&d);
                let mut day: Vec<(i64, PathBuf)> = sorted_names(&dir)
                    .into_iter()
                    .filter(|f| f.ends_with(".jsonl"))
                    .map(|f| dir.join(f))
                    .map(|p| (mtime_secs(&p).unwrap_or(0), p))
                    .collect();
                day.sort_by(|a, b| b.0.cmp(&a.0));
                out.extend(day);
                if out.len() >= limit {
                    out.truncate(limit);
                    return out.into_iter().map(|(_, p)| p).collect();
                }
            }
        }
    }
    out.into_iter().map(|(_, p)| p).collect()
}

fn read_tail(path: &Path) -> Option<String> {
    let mut f = fs::File::open(path).ok()?;
    let len = f.metadata().ok()?.len();
    f.seek(SeekFrom::Start(len.saturating_sub(CODEX_TAIL_BYTES))).ok()?;
    let mut buf = Vec::new();
    f.read_to_end(&mut buf).ok()?;
    Some(String::from_utf8_lossy(&buf).into_owned())
}

fn read_codex(home: &Path, now: i64) -> Value {
    let dir = home.join(".codex").join("sessions");
    for file in newest_codex_files(&dir, 5) {
        let Some(tail) = read_tail(&file) else { continue };
        for line in tail.lines().rev() {
            if !line.contains("\"rate_limits\"") {
                continue;
            }
            let Ok(ev) = serde_json::from_str::<Value>(line) else { continue };
            let Some(rl) = ev.get("payload").and_then(|p| p.get("rate_limits")) else { continue };
            let Some(primary) = rl.get("primary").filter(|p| p.is_object()) else { continue };
            let null = Value::Null;
            let secondary = rl.get("secondary").unwrap_or(&null);
            return quota_value(primary, secondary, now);
        }
    }
    Value::Null
}

// ---------- watcher thread ----------

fn build_payload(root: &Path, codex: &Value) -> Value {
    let now = now_secs();
    let mut rows = read_sessions(root, now);
    merge_workers(root, now, &mut rows);
    let (claude, age) = read_claude_limits(root, now);
    json!({
        "sessions": rows_to_json(rows),
        "claude": claude,
        "codex": codex,
        "age": age,
    })
}

pub fn spawn_watcher(app: AppHandle, store: StateStore) {
    std::thread::spawn(move || {
        let root = root_dir();
        let home = home_dir();
        let mut codex = Value::Null;
        let mut codex_at: Option<Instant> = None;
        let mut last = String::new();
        loop {
            let result = catch_unwind(AssertUnwindSafe(|| {
                let root = root.as_deref()?;
                if codex_at.map_or(true, |t| t.elapsed() >= CODEX_REFRESH) {
                    codex_at = Some(Instant::now());
                    codex = home
                        .as_deref()
                        .map_or(Value::Null, |h| read_codex(h, now_secs()));
                }
                Some(build_payload(root, &codex))
            }));
            if let Ok(Some(payload)) = result {
                if let Ok(serialized) = serde_json::to_string(&payload) {
                    if serialized != last {
                        last = serialized;
                        if let Ok(mut slot) = store.0.lock() {
                            *slot = payload.clone();
                        }
                        let _ = app.emit("centik-state", payload);
                    }
                }
            }
            std::thread::sleep(Duration::from_secs(1));
        }
    });
}
