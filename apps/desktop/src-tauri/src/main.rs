#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{
    fs,
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
};
use tauri::{Manager, RunEvent};
mod companion;
mod service;
struct Backend(Mutex<Option<Child>>);
struct ServiceLifetime(Mutex<Option<service::ServiceJob>>);
#[derive(serde::Serialize)]
struct LocalConnection {
    url: String,
    token: String,
}
fn data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if cfg!(debug_assertions) {
        Ok(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../.data"))
    } else {
        app.path()
            .app_local_data_dir()
            .map(|p| p.join("backend"))
            .map_err(|e| e.to_string())
    }
}
#[tauri::command]
fn local_connection(app: tauri::AppHandle) -> Result<LocalConnection, String> {
    let token = fs::read_to_string(data_dir(&app)?.join("backend-token"))
        .map_err(|_| "Lokaler Dienst startet noch oder ist nicht erreichbar.".to_string())?;
    Ok(LocalConnection {
        url: "http://127.0.0.1:4310".into(),
        token: token.trim().into(),
    })
}
fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Backend(Mutex::new(None)))
        .manage(ServiceLifetime(Mutex::new(None)))
        .on_window_event(|window, event| {
            if window.label() == "main"
                && matches!(event, tauri::WindowEvent::CloseRequested { .. })
            {
                window.app_handle().exit(0);
            }
        })
        .invoke_handler(tauri::generate_handler![
            local_connection,
            companion::native_settings,
            companion::save_native_settings,
            companion::toggle_overlay,
            companion::recover_overlay,
            companion::overlay_position,
            companion::suspend_hotkeys,
            companion::overlay_navigate
        ])
        .setup(|app| {
            companion::setup(app.handle()).map_err(std::io::Error::other)?;
            if !cfg!(debug_assertions) {
                let directory = data_dir(app.handle()).map_err(std::io::Error::other)?;
                fs::create_dir_all(&directory)?;
                let resources = app.path().resource_dir()?.join("service");
                service::reclaim_previous_service(&resources.join("node.exe"))?;
                let log = fs::OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(directory.join("backend.log"))?;
                let mut command = Command::new(resources.join("node.exe"));
                command
                    // Node's entry-point resolver rejects extended Windows paths
                    // on some runtimes. Resolve the entry point from its directory.
                    .current_dir(&resources)
                    .arg("backend.mjs")
                    .env("DATA_DIR", &directory)
                    .env("HOST", "127.0.0.1")
                    .env("PORT", "4310")
                    .env(
                        "COMPANION_CATALOG_SEED",
                        resources.join("catalog-seed.sqlite"),
                    )
                    .stdin(Stdio::null())
                    .stdout(log.try_clone()?)
                    .stderr(log);
                #[cfg(windows)]
                {
                    use std::os::windows::process::CommandExt;
                    command.creation_flags(0x08000000);
                }
                let mut child = command.spawn()?;
                let guard = match service::ServiceJob::attach(&child) {
                    Ok(guard) => guard,
                    Err(error) => {
                        let _ = child.kill();
                        let _ = child.wait();
                        return Err(error.into());
                    }
                };
                *app.state::<ServiceLifetime>().0.lock().unwrap() = Some(guard);
                *app.state::<Backend>().0.lock().unwrap() = Some(child);
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("DOFUS Companion konnte nicht gestartet werden");
    app.run(|app, event| {
        if matches!(event, RunEvent::Exit) {
            companion::shutdown(app);
            if let Ok(mut state) = app.state::<Backend>().0.lock() {
                if let Some(child) = state.as_mut() {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        }
    });
}
