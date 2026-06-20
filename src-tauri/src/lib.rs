use std::sync::Mutex;
use tauri::Manager;

struct SidecarState(Mutex<Vec<(u32, String)>>);

#[tauri::command]
fn register_sidecar_pid(state: tauri::State<SidecarState>, pid: u32, tag: String) {
    state.0.lock().unwrap().push((pid, tag));
}

#[tauri::command]
fn kill_sidecars_by_tag(state: tauri::State<SidecarState>, tag: String) {
    let mut pids = state.0.lock().unwrap();
    let to_kill: Vec<u32> = pids.iter().filter(|(_, t)| *t == tag).map(|(pid, _)| *pid).collect();
    pids.retain(|(_, t)| *t != tag);
    for pid in to_kill {
        kill_pid(pid);
    }
}

#[tauri::command]
fn kill_all_sidecars(state: tauri::State<SidecarState>) {
    let pids = state.0.lock().unwrap().drain(..).collect::<Vec<_>>();
    for (pid, _) in pids {
        kill_pid(pid);
    }
}

fn kill_pid(pid: u32) {
    #[cfg(target_family = "unix")]
    {
        let _ = std::process::Command::new("kill").arg("-TERM").arg(pid.to_string()).output();
    }
    #[cfg(target_family = "windows")]
    {
        let _ = std::process::Command::new("taskkill").arg("/PID").arg(pid.to_string()).arg("/F").output();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SidecarState(Mutex::new(Vec::new())))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            register_sidecar_pid,
            kill_sidecars_by_tag,
            kill_all_sidecars
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let handle = app.handle().clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { .. } = event {
                        let state = handle.state::<SidecarState>();
                        let pids = state.0.lock().unwrap().drain(..).collect::<Vec<_>>();
                        for (pid, _) in pids {
                            kill_pid(pid);
                        }
                    }
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}
