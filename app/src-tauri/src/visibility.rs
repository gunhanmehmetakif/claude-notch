use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tauri::{AppHandle, Manager};

/// Two independent reasons to hide the window; it is visible only when both are false.
pub struct Visibility {
    /// Hidden by the user from the tray menu / left click.
    user_hidden: AtomicBool,
    /// Hidden because a full-screen app, game or presentation is running.
    fullscreen_hidden: AtomicBool,
    /// What we last asked the window to be, so show/hide run only on change.
    shown: AtomicBool,
}

impl Default for Visibility {
    fn default() -> Self {
        Self {
            user_hidden: AtomicBool::new(false),
            fullscreen_hidden: AtomicBool::new(false),
            shown: AtomicBool::new(true), // tauri.conf.json starts the window visible
        }
    }
}

impl Visibility {
    pub fn user_hidden(&self) -> bool {
        self.user_hidden.load(Ordering::SeqCst)
    }

    pub fn set_user_hidden(&self, v: bool) {
        self.user_hidden.store(v, Ordering::SeqCst);
    }

    pub fn set_fullscreen_hidden(&self, v: bool) {
        self.fullscreen_hidden.store(v, Ordering::SeqCst);
    }
}

/// Reconcile the real window with the two flags. Never steals focus.
pub fn apply(app: &AppHandle) {
    let vis = app.state::<Visibility>();
    let want = !vis.user_hidden.load(Ordering::SeqCst) && !vis.fullscreen_hidden.load(Ordering::SeqCst);
    if vis.shown.swap(want, Ordering::SeqCst) == want {
        return;
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = if want { window.show() } else { window.hide() };
    }
}

/// Poll the shell notification state and hide the window while a full-screen app runs.
#[cfg(windows)]
pub fn spawn_fullscreen_watcher(app: AppHandle) {
    use windows::Win32::UI::Shell::{
        SHQueryUserNotificationState, QUNS_BUSY, QUNS_PRESENTATION_MODE,
        QUNS_RUNNING_D3D_FULL_SCREEN,
    };

    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_millis(1500));
        let Ok(state) = (unsafe { SHQueryUserNotificationState() }) else {
            continue;
        };
        let full = state == QUNS_BUSY
            || state == QUNS_RUNNING_D3D_FULL_SCREEN
            || state == QUNS_PRESENTATION_MODE;
        app.state::<Visibility>().set_fullscreen_hidden(full);
        apply(&app);
    });
}

#[cfg(not(windows))]
pub fn spawn_fullscreen_watcher(_app: AppHandle) {
    let _ = Duration::from_millis(0);
}
