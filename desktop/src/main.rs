// Spike: does a plain Tauri v2 shell give us (1) the Swift helper bundled as a
// sidecar, (2) microphone capture, (3) a second projector window that stays in
// sync with the operator window?
use tauri_plugin_shell::ShellExt;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            match app.shell().sidecar("FlowCastVoice") {
                Ok(cmd) => match cmd.spawn() {
                    Ok(_) => println!("SPIKE sidecar: spawned"),
                    Err(e) => println!("SPIKE sidecar: spawn failed: {e}"),
                },
                Err(e) => println!("SPIKE sidecar: not found: {e}"),
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
