use serde::{Deserialize, Serialize};
use std::{collections::HashSet, fs, path::PathBuf, str::FromStr, sync::Mutex};
use tauri::{Emitter, LogicalPosition, LogicalSize, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

pub const RECOVERY: &str = "Ctrl+Alt+Shift+O";
const ACTIONS: &[&str] = &[
    "overlay",
    "main",
    "questScanner",
    "itemScanner",
    "search",
    "compact",
    "treasure",
];
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Binding {
    pub action: String,
    pub accelerator: String,
    pub enabled: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OverlayWindow {
    pub width: f64,
    pub height: f64,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub always_on_top: bool,
    pub click_through: bool,
    pub locked: bool,
    pub snap: bool,
}
impl Default for OverlayWindow {
    fn default() -> Self {
        Self {
            width: 460.,
            height: 650.,
            x: None,
            y: None,
            always_on_top: true,
            click_through: false,
            locked: false,
            snap: true,
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub schema_version: u32,
    pub overlay: OverlayWindow,
    pub hotkeys: Vec<Binding>,
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            schema_version: 1,
            overlay: OverlayWindow::default(),
            hotkeys: vec![
                Binding {
                    action: "overlay".into(),
                    accelerator: "F8".into(),
                    enabled: true,
                },
                Binding {
                    action: "main".into(),
                    accelerator: "Ctrl+Shift+D".into(),
                    enabled: true,
                },
                Binding {
                    action: "questScanner".into(),
                    accelerator: "Ctrl+Shift+Q".into(),
                    enabled: true,
                },
                Binding {
                    action: "itemScanner".into(),
                    accelerator: "Ctrl+Shift+I".into(),
                    enabled: false,
                },
                Binding {
                    action: "search".into(),
                    accelerator: "Ctrl+Alt+S".into(),
                    enabled: false,
                },
                Binding {
                    action: "compact".into(),
                    accelerator: "Ctrl+Alt+C".into(),
                    enabled: false,
                },
                Binding {
                    action: "treasure".into(),
                    accelerator: "Ctrl+Alt+T".into(),
                    enabled: false,
                },
            ],
        }
    }
}
pub struct NativeState {
    pub settings: Mutex<Settings>,
    pub startup_error: Mutex<Option<String>>,
    pub recovery: Mutex<bool>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsResponse {
    pub settings: Settings,
    pub recovery_hotkey: &'static str,
    pub recovery_registered: bool,
    pub startup_error: Option<String>,
}
fn path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|p| p.join("native-settings.json"))
        .map_err(|e| e.to_string())
}
fn persist(app: &tauri::AppHandle, settings: &Settings) -> Result<(), String> {
    let target = path(app)?;
    fs::create_dir_all(target.parent().unwrap()).map_err(|e| e.to_string())?;
    let temporary = target.with_extension("json.tmp");
    fs::write(
        &temporary,
        serde_json::to_vec_pretty(settings).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    fs::rename(temporary, target).map_err(|e| e.to_string())
}
pub fn validate(settings: &Settings) -> Result<(), String> {
    if !(260. ..=1800.).contains(&settings.overlay.width)
        || !(160. ..=1600.).contains(&settings.overlay.height)
    {
        return Err("Overlay-Größe muss zwischen 260 × 160 und 1800 × 1600 liegen.".into());
    }
    if [settings.overlay.x, settings.overlay.y]
        .into_iter()
        .flatten()
        .any(|n| !n.is_finite() || n.abs() > 100_000.)
    {
        return Err("Ungültige Overlay-Position.".into());
    }
    let recovery = Shortcut::from_str(RECOVERY).unwrap().id();
    let mut seen = HashSet::new();
    let mut actions = HashSet::new();
    for binding in &settings.hotkeys {
        if !ACTIONS.contains(&binding.action.as_str()) || !actions.insert(binding.action.clone()) {
            return Err("Unbekannte oder doppelte Hotkey-Aktion.".into());
        }
        if !binding.enabled {
            continue;
        }
        let shortcut = Shortcut::from_str(&binding.accelerator)
            .map_err(|_| format!("Ungültige Tastenkombination für {}", binding.action))?;
        let text = binding.accelerator.to_ascii_lowercase().replace(' ', "");
        if shortcut.id() == recovery
            || text.contains("super")
            || text.contains("meta")
            || text.contains("win")
            || [
                "alt+f4",
                "alt+tab",
                "ctrl+alt+delete",
                "ctrl+shift+escape",
                "escape",
                "enter",
                "tab",
                "space",
                "delete",
                "backspace",
            ]
            .contains(&text.as_str())
        {
            return Err(
                "Diese Kombination ist für Windows oder die sichere Overlay-Rückkehr reserviert."
                    .into(),
            );
        }
        if !text.contains('+') && !text.starts_with('f') {
            return Err(
                "Einzelne Buchstaben benötigen eine Zusatztaste (Strg/Alt/Umschalt).".into(),
            );
        }
        if !seen.insert(shortcut.id()) {
            return Err("Eine Tastenkombination wurde mehrfach zugewiesen.".into());
        }
    }
    Ok(())
}
fn show_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}
fn recover(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("overlay") {
        let _ = window.set_ignore_cursor_events(false);
        let _ = window.hide();
    }
    let state = app.state::<NativeState>();
    if let Ok(mut settings) = state.settings.lock() {
        settings.overlay.click_through = false;
        let _ = persist(app, &settings);
    }
    show_main(app);
    let _ = app.emit("companion:action", "settings");
}
fn trigger(app: &tauri::AppHandle, action: &str) {
    if action == "overlay" {
        let handle = app.clone();
        tauri::async_runtime::spawn(async move {
            let _ = toggle_overlay_impl(handle);
        });
        return;
    }
    show_main(app);
    let _ = app.emit("companion:action", action);
}
fn register_bindings(app: &tauri::AppHandle, settings: &Settings) -> Result<(), String> {
    for binding in settings.hotkeys.iter().filter(|binding| binding.enabled) {
        let action = binding.action.clone();
        app.global_shortcut()
            .on_shortcut(binding.accelerator.as_str(), move |app, _, event| {
                if event.state == ShortcutState::Pressed {
                    trigger(app, &action);
                }
            })
            .map_err(|e| {
                format!(
                    "Hotkey {} ist bereits belegt oder konnte nicht registriert werden: {}",
                    binding.accelerator, e
                )
            })?;
    }
    Ok(())
}
pub fn setup(app: &tauri::AppHandle) -> Result<(), String> {
    let settings = path(app)
        .ok()
        .and_then(|path| fs::read(path).ok())
        .and_then(|bytes| serde_json::from_slice::<Settings>(&bytes).ok())
        .filter(|settings| validate(settings).is_ok())
        .unwrap_or_default();
    app.manage(NativeState {
        settings: Mutex::new(settings.clone()),
        startup_error: Mutex::new(None),
        recovery: Mutex::new(false),
    });
    let safety = app
        .global_shortcut()
        .on_shortcut(RECOVERY, |app, _, event| {
            if event.state == ShortcutState::Pressed {
                recover(app);
            }
        });
    *app.state::<NativeState>().recovery.lock().unwrap() = safety.is_ok();
    if let Err(error) = safety {
        *app.state::<NativeState>().startup_error.lock().unwrap() = Some(format!(
            "Sicherheits-Hotkey nicht verfügbar; Click-through bleibt deaktiviert: {error}"
        ));
    }
    if let Err(error) = register_bindings(app, &settings) {
        *app.state::<NativeState>().startup_error.lock().unwrap() = Some(error);
    }
    Ok(())
}
fn apply_window(app: &tauri::AppHandle, settings: &Settings) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("overlay") {
        window
            .set_always_on_top(settings.overlay.always_on_top)
            .map_err(|e| e.to_string())?;
        window
            .set_resizable(!settings.overlay.locked)
            .map_err(|e| e.to_string())?;
        window
            .set_size(LogicalSize::new(
                settings.overlay.width,
                settings.overlay.height,
            ))
            .map_err(|e| e.to_string())?;
        if let (Some(x), Some(y)) = (settings.overlay.x, settings.overlay.y) {
            let monitors = window.available_monitors().map_err(|e| e.to_string())?;
            let visible = monitors.iter().any(|monitor| {
                let scale = monitor.scale_factor();
                let p = monitor.position();
                let size = monitor.size();
                let left = p.x as f64 / scale;
                let top = p.y as f64 / scale;
                x + settings.overlay.width > left + 40.
                    && x < left + size.width as f64 / scale - 40.
                    && y + settings.overlay.height > top + 40.
                    && y < top + size.height as f64 / scale - 40.
            });
            if visible {
                window
                    .set_position(LogicalPosition::new(x, y))
                    .map_err(|e| e.to_string())?;
            } else {
                window.center().map_err(|e| e.to_string())?;
            }
        }
        let recovery = *app.state::<NativeState>().recovery.lock().unwrap();
        window
            .set_ignore_cursor_events(settings.overlay.click_through && recovery)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
fn ensure_overlay(app: &tauri::AppHandle) -> Result<(), String> {
    if app.get_webview_window("overlay").is_none() {
        WebviewWindowBuilder::new(
            app,
            "overlay",
            WebviewUrl::App("index.html?overlay=1".into()),
        )
        .title("DOFUS Companion Overlay")
        .inner_size(460., 650.)
        .min_inner_size(260., 160.)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .build()
        .map_err(|e| e.to_string())?;
    }
    let settings = app.state::<NativeState>().settings.lock().unwrap().clone();
    apply_window(app, &settings)
}
#[tauri::command]
pub fn native_settings(app: tauri::AppHandle) -> SettingsResponse {
    let state = app.state::<NativeState>();
    let settings = state.settings.lock().unwrap().clone();
    let recovery_registered = *state.recovery.lock().unwrap();
    let startup_error = state.startup_error.lock().unwrap().clone();
    SettingsResponse {
        settings,
        recovery_hotkey: RECOVERY,
        recovery_registered,
        startup_error,
    }
}
#[tauri::command]
pub fn save_native_settings(
    app: tauri::AppHandle,
    mut settings: Settings,
) -> Result<SettingsResponse, String> {
    validate(&settings)?;
    let state = app.state::<NativeState>();
    if settings.overlay.click_through && !*state.recovery.lock().unwrap() {
        return Err(
            "Click-through benötigt den verfügbaren Sicherheits-Hotkey Strg + Alt + Umschalt + O."
                .into(),
        );
    }
    let previous = state.settings.lock().unwrap().clone();
    for binding in previous.hotkeys.iter().filter(|binding| binding.enabled) {
        let _ = app
            .global_shortcut()
            .unregister(binding.accelerator.as_str());
    }
    if let Err(error) = register_bindings(&app, &settings) {
        for binding in settings.hotkeys.iter().filter(|binding| binding.enabled) {
            let _ = app
                .global_shortcut()
                .unregister(binding.accelerator.as_str());
        }
        let _ = register_bindings(&app, &previous);
        return Err(error);
    }
    settings.schema_version = 1;
    if let Err(error) = apply_window(&app, &settings).and_then(|_| persist(&app, &settings)) {
        for binding in settings.hotkeys.iter().filter(|binding| binding.enabled) {
            let _ = app
                .global_shortcut()
                .unregister(binding.accelerator.as_str());
        }
        let _ = register_bindings(&app, &previous);
        let _ = apply_window(&app, &previous);
        return Err(error);
    }
    *state.settings.lock().unwrap() = settings.clone();
    *state.startup_error.lock().unwrap() = None;
    let _ = app.emit("overlay:settings", &settings);
    Ok(native_settings(app))
}
#[tauri::command]
pub async fn toggle_overlay(app: tauri::AppHandle) -> Result<bool, String> {
    toggle_overlay_impl(app)
}
fn toggle_overlay_impl(app: tauri::AppHandle) -> Result<bool, String> {
    ensure_overlay(&app)?;
    let window = app
        .get_webview_window("overlay")
        .ok_or("Overlay konnte nicht erstellt werden.")?;
    let show = !window.is_visible().map_err(|e| e.to_string())?;
    if show {
        window.show().map_err(|e| e.to_string())?;
        let _ = app.emit("overlay:request-snapshot", ());
    } else {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(show)
}
#[tauri::command]
pub fn recover_overlay(app: tauri::AppHandle) {
    recover(&app);
}
#[tauri::command]
pub fn overlay_navigate(app: tauri::AppHandle, action: String) -> Result<(), String> {
    if action.len() > 300
        || ![
            "main",
            "questScanner",
            "itemScanner",
            "search",
            "compact",
            "treasure",
            "items",
            "quests",
            "settings",
        ]
        .iter()
        .any(|prefix| action == *prefix || action.starts_with(&format!("{prefix}:")))
    {
        return Err("Unbekannte Companion-Aktion.".into());
    }
    trigger(&app, &action);
    Ok(())
}
#[tauri::command]
pub fn suspend_hotkeys(app: tauri::AppHandle, suspended: bool) -> Result<(), String> {
    let settings = app.state::<NativeState>().settings.lock().unwrap().clone();
    if suspended {
        for binding in settings.hotkeys.iter().filter(|binding| binding.enabled) {
            let _ = app
                .global_shortcut()
                .unregister(binding.accelerator.as_str());
        }
        Ok(())
    } else {
        for binding in settings.hotkeys.iter().filter(|binding| binding.enabled) {
            let _ = app
                .global_shortcut()
                .unregister(binding.accelerator.as_str());
        }
        register_bindings(&app, &settings)
    }
}
#[tauri::command]
pub fn overlay_position(app: tauri::AppHandle) -> Result<SettingsResponse, String> {
    if let Some(window) = app.get_webview_window("overlay") {
        let scale = window.scale_factor().map_err(|e| e.to_string())?;
        let position = window.outer_position().map_err(|e| e.to_string())?;
        let size = window.inner_size().map_err(|e| e.to_string())?;
        let state = app.state::<NativeState>();
        let mut settings = state.settings.lock().unwrap();
        let mut x = position.x as f64 / scale;
        let mut y = position.y as f64 / scale;
        if settings.overlay.snap {
            if let Some(monitor) = window.current_monitor().map_err(|e| e.to_string())? {
                let p = monitor.position();
                let s = monitor.size();
                let left = p.x as f64 / scale;
                let top = p.y as f64 / scale;
                let right = left + s.width as f64 / scale - size.width as f64 / scale;
                let bottom = top + s.height as f64 / scale - size.height as f64 / scale;
                if (x - left).abs() < 25. {
                    x = left;
                }
                if (x - right).abs() < 25. {
                    x = right;
                }
                if (y - top).abs() < 25. {
                    y = top;
                }
                if (y - bottom).abs() < 25. {
                    y = bottom;
                }
            }
        }
        settings.overlay.x = Some(x);
        settings.overlay.y = Some(y);
        settings.overlay.width = size.width as f64 / scale;
        settings.overlay.height = size.height as f64 / scale;
        persist(&app, &settings)?;
    }
    Ok(native_settings(app))
}
pub fn shutdown(app: &tauri::AppHandle) {
    let _ = overlay_position(app.clone());
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn default_bindings_are_valid() {
        assert!(validate(&Settings::default()).is_ok());
    }
    #[test]
    fn duplicates_and_recovery_are_rejected() {
        let mut settings = Settings::default();
        settings.hotkeys[1].accelerator = "F8".into();
        assert!(validate(&settings).is_err());
        settings.hotkeys[1].accelerator = RECOVERY.into();
        assert!(validate(&settings).is_err());
    }
    #[test]
    fn reserved_windows_keys_are_rejected() {
        let mut settings = Settings::default();
        settings.hotkeys[0].accelerator = "Alt+F4".into();
        assert!(validate(&settings).is_err());
    }
    #[test]
    fn invalid_sizes_and_old_settings_are_handled() {
        let mut settings = Settings::default();
        settings.overlay.width = f64::NAN;
        assert!(validate(&settings).is_err());
        let migrated: Settings = serde_json::from_str("{\"overlay\":{\"width\":500}} ").unwrap();
        assert_eq!(migrated.overlay.width, 500.);
        assert_eq!(migrated.hotkeys.len(), 7);
    }
}
