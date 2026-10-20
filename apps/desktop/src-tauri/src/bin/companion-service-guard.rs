#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#[path = "../service.rs"]
#[allow(dead_code)]
mod service;
fn main() {
    let Some(path) = std::env::args_os().nth(1) else {
        std::process::exit(2);
    };
    if let Err(error) = service::reclaim_previous_service(std::path::Path::new(&path)) {
        eprintln!("Companion-Dienstübergabe: {error}");
        std::process::exit(1);
    }
}
