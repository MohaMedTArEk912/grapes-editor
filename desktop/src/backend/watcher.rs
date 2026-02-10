//! File System Watcher
//! 
//! Monitors the project root directory for changes and notifies the frontend.

use notify::{RecursiveMode, Watcher, Config};
use std::path::PathBuf;
use tauri::Emitter;
use tokio::sync::mpsc;
use tracing::info;

/// Events emitted to the frontend
#[derive(Debug, serde::Serialize, Clone)]
pub struct VfsChangeEvent {
    pub path: String,
    pub kind: String,
}

pub struct FsWatcher {
    watcher: Option<notify::RecommendedWatcher>,
    _stop_tx: Option<mpsc::Sender<()>>,
}

impl FsWatcher {
    pub fn new() -> Self {
        Self {
            watcher: None,
            _stop_tx: None,
        }
    }

    /// Start watching a directory
    pub fn watch<R: tauri::Runtime>(
        &mut self,
        root_path: impl Into<PathBuf>,
        app_handle: tauri::AppHandle<R>,
    ) -> anyhow::Result<()> {
        let root_path = root_path.into();
        let canon_root = root_path.canonicalize()?;
        
        info!("Starting file watcher for: {:?}", canon_root);

        // Stop existing watcher if any
        self.unwatch();

        let (tx, mut rx) = mpsc::channel(100);

        // Configure and create the watcher
        let mut watcher = notify::RecommendedWatcher::new(
            move |res: notify::Result<notify::Event>| {
                if let Ok(event) = res {
                    let _ = tx.blocking_send(event);
                }
            },
            Config::default(),
        )?;

        watcher.watch(&canon_root, RecursiveMode::Recursive)?;

        // Background task to process events and emit to Tauri
        let canon_root_clone = canon_root.clone();
        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                // Determine the type of change
                let kind = match event.kind {
                    notify::EventKind::Create(_) => "create",
                    notify::EventKind::Modify(_) => "modify",
                    notify::EventKind::Remove(_) => "remove",
                    _ => "other",
                };

                for path in event.paths {
                    if let Ok(rel_path) = path.strip_prefix(&canon_root_clone) {
                        let rel_path_str = rel_path.to_string_lossy().to_string().replace('\\', "/");
                        
                        let payload = VfsChangeEvent {
                            path: rel_path_str,
                            kind: kind.to_string(),
                        };

                        // Emit to frontend
                        let _ = app_handle.emit("vfs://change", payload);
                    }
                }
            }
        });

        self.watcher = Some(watcher);
        Ok(())
    }

    /// Stop watching
    pub fn unwatch(&mut self) {
        if let Some(watcher) = self.watcher.take() {
            // Watcher is dropped, which stops it
            drop(watcher);
        }
    }
}
