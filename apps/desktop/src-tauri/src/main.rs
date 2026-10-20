#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{fs, path::PathBuf, process::{Child, Command, Stdio}, sync::Mutex};
use tauri::{Manager, RunEvent};
struct Backend(Mutex<Option<Child>>);
#[derive(serde::Serialize)]
struct LocalConnection { url: String, token: String }
fn data_dir(app: &tauri::AppHandle) -> Result<PathBuf,String> {
    if cfg!(debug_assertions) { Ok(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../.data")) }
    else { app.path().app_local_data_dir().map(|p|p.join("backend")).map_err(|e|e.to_string()) }
}
#[tauri::command]
fn local_connection(app: tauri::AppHandle) -> Result<LocalConnection,String> {
    let token = fs::read_to_string(data_dir(&app)?.join("backend-token")).map_err(|_|"Lokaler Dienst startet noch oder ist nicht erreichbar.".to_string())?;
    Ok(LocalConnection { url:"http://127.0.0.1:4310".into(), token:token.trim().into() })
}
fn main() {
    let app=tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app,_,_| {if let Some(window)=app.get_webview_window("main"){let _=window.show();let _=window.set_focus();}}))
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Backend(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![local_connection])
        .setup(|app| {
            if !cfg!(debug_assertions) {
                let directory=data_dir(app.handle()).map_err(std::io::Error::other)?;
                fs::create_dir_all(&directory)?;
                let resources=app.path().resource_dir()?.join("service");
                let log=fs::OpenOptions::new().create(true).append(true).open(directory.join("backend.log"))?;
                let mut command=Command::new(resources.join("node.exe"));
                command.arg(resources.join("backend.mjs")).env("DATA_DIR",&directory).env("HOST","127.0.0.1").env("PORT","4310").stdin(Stdio::null()).stdout(log.try_clone()?).stderr(log);
                #[cfg(windows)] { use std::os::windows::process::CommandExt; command.creation_flags(0x08000000); }
                let child=command.spawn()?;
                *app.state::<Backend>().0.lock().unwrap()=Some(child);
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("DOFUS Companion konnte nicht gestartet werden");
    app.run(|app,event|{if matches!(event,RunEvent::Exit){if let Ok(mut state)=app.state::<Backend>().0.lock(){if let Some(child)=state.as_mut(){let _=child.kill();let _=child.wait();}}}});
}
