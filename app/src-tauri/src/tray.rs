use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_autostart::ManagerExt;

use crate::settings;
use crate::visibility::{self, Visibility};

const HIDE_TEXT: &str = "Çentiği gizle";
const SHOW_TEXT: &str = "Çentiği göster";

fn toggle_user_hidden(app: &AppHandle, item: &MenuItem<tauri::Wry>) {
    let vis = app.state::<Visibility>();
    let hidden = !vis.user_hidden();
    vis.set_user_hidden(hidden);
    let _ = item.set_text(if hidden { SHOW_TEXT } else { HIDE_TEXT });
    visibility::apply(app);
}

pub fn setup(app: &tauri::App) -> tauri::Result<()> {
    let toggle = MenuItem::with_id(app, "toggle", HIDE_TEXT, true, None::<&str>)?;
    let enabled = app.autolaunch().is_enabled().unwrap_or(false);
    let autostart = CheckMenuItem::with_id(
        app,
        "autostart",
        "Bilgisayar açılınca başlat",
        true,
        enabled,
        None::<&str>,
    )?;
    let style_now = settings::read_rest_style();
    let rest_smoke = CheckMenuItem::with_id(
        app,
        "rest_smoke",
        "Sigara",
        true,
        style_now == settings::SMOKE,
        None::<&str>,
    )?;
    let rest_coffee = CheckMenuItem::with_id(
        app,
        "rest_coffee",
        "Kahve",
        true,
        style_now == settings::COFFEE,
        None::<&str>,
    )?;
    let rest_menu = Submenu::with_items(app, "Mola stili", true, &[&rest_smoke, &rest_coffee])?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Çıkış", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&toggle, &autostart, &rest_menu, &sep, &quit])?;

    let toggle_menu = toggle.clone();
    let toggle_click = toggle.clone();
    let autostart_menu = autostart.clone();
    let smoke_menu = rest_smoke.clone();
    let coffee_menu = rest_coffee.clone();

    let mut builder = TrayIconBuilder::with_id("main")
        .tooltip("Claude Çentiği")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "toggle" => toggle_user_hidden(app, &toggle_menu),
            "autostart" => {
                // The check mark flips on click; apply the new state and revert on failure.
                let want = autostart_menu.is_checked().unwrap_or(false);
                let manager = app.autolaunch();
                let result = if want { manager.enable() } else { manager.disable() };
                if result.is_err() {
                    let _ = autostart_menu.set_checked(!want);
                }
            }
            id @ ("rest_smoke" | "rest_coffee") => {
                let style = if id == "rest_coffee" { settings::COFFEE } else { settings::SMOKE };
                let _ = settings::write_rest_style(style);
                // Radio behaviour: exactly one item stays checked.
                let _ = smoke_menu.set_checked(style == settings::SMOKE);
                let _ = coffee_menu.set_checked(style == settings::COFFEE);
                let _ = app.emit("rest-style", style);
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(move |tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_user_hidden(tray.app_handle(), &toggle_click);
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}
