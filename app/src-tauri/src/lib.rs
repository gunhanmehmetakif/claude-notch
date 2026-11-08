mod settings;
mod state;
mod tray;
mod visibility;

use std::sync::{Arc, Mutex};
use std::time::Duration;

use tauri::{Emitter, Manager, PhysicalPosition, State, WebviewWindow};

/// Interactive area of the notch in CSS (logical) px, relative to the window.
#[derive(Clone, Copy, Default)]
struct HitRect {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

#[derive(Clone, Default)]
struct HitState(Arc<Mutex<HitRect>>);

#[tauri::command]
fn set_hit_rect(state: State<'_, HitState>, x: f64, y: f64, w: f64, h: f64) {
    if let Ok(mut r) = state.0.lock() {
        *r = HitRect { x, y, w, h };
    }
}

/// Center the window on the top edge of the primary monitor (physical px).
fn place_top_center(window: &WebviewWindow) {
    let monitor = match window.primary_monitor() {
        Ok(Some(m)) => m,
        _ => return,
    };
    let Ok(outer) = window.outer_size() else { return };
    let mpos = monitor.position();
    let msize = monitor.size();
    let x = mpos.x + (msize.width as i32 - outer.width as i32) / 2;
    let _ = window.set_position(PhysicalPosition::new(x, mpos.y));
}

#[cfg(windows)]
fn remove_border(window: &WebviewWindow) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_BORDER_COLOR};

    // DWMWA_COLOR_NONE: draw no border at all.
    const DWMWA_COLOR_NONE: u32 = 0xFFFF_FFFE;

    let Ok(raw) = window.hwnd() else { return };
    // Rebuild the handle so a windows crate version mismatch with tauri does not matter.
    let hwnd = HWND(raw.0 as _);
    unsafe {
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_BORDER_COLOR,
            &DWMWA_COLOR_NONE as *const u32 as *const _,
            std::mem::size_of::<u32>() as u32,
        );
    }
}

/// Poll the global cursor and toggle click-through only when the state changes.
fn spawn_cursor_watcher(window: WebviewWindow, state: HitState) {
    std::thread::spawn(move || {
        let mut inside = false;
        loop {
            std::thread::sleep(Duration::from_millis(40));
            let (Ok(cursor), Ok(pos), Ok(scale)) = (
                window.cursor_position(),
                window.outer_position(),
                window.scale_factor(),
            ) else {
                continue;
            };
            let r = match state.0.lock() {
                Ok(r) => *r,
                Err(_) => continue,
            };
            let left = pos.x as f64 + r.x * scale;
            let top = pos.y as f64 + r.y * scale;
            let now_inside = r.w > 0.0
                && r.h > 0.0
                && cursor.x >= left
                && cursor.x < left + r.w * scale
                && cursor.y >= top
                && cursor.y < top + r.h * scale;
            if now_inside != inside {
                inside = now_inside;
                let _ = window.set_ignore_cursor_events(!inside);
                let _ = window.emit("cursor-inside", inside);
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must be registered first. A second launch shows the window (no focus) and exits.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            app.state::<visibility::Visibility>().set_user_hidden(false);
            visibility::apply(app);
        }))
        // Autostart stays off until the user ticks it in the tray menu.
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(visibility::Visibility::default())
        .manage(HitState::default())
        .manage(state::StateStore::default())
        .invoke_handler(tauri::generate_handler![set_hit_rect,
            state::get_state,
            settings::get_rest_style
        ])
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("main window is defined in tauri.conf.json");
            place_top_center(&window);
            #[cfg(windows)]
            remove_border(&window);
            let _ = window.set_ignore_cursor_events(true);
            // The watcher thread shares the rect the command writes.
            spawn_cursor_watcher(window, app.state::<HitState>().inner().clone());
            state::spawn_watcher(
                app.handle().clone(),
                app.state::<state::StateStore>().inner().clone(),
            );
            tray::setup(app)?;
            visibility::spawn_fullscreen_watcher(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
