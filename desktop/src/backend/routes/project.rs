//! Project routes

use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use std::time::Instant;

use crate::backend::error::ApiError;
use crate::backend::state::AppState;
use crate::schema::ProjectSchema;

/// Create project request
#[derive(Debug, Deserialize)]
pub struct CreateProjectRequest {
    pub name: String,
}

/// Get current project
pub async fn get_project(
    State(state): State<AppState>,
) -> Result<Json<Option<ProjectSchema>>, ApiError> {
    let project = state.get_project().await;
    Ok(Json(project))
}

/// Create new project
pub async fn create_project(
    State(state): State<AppState>,
    Json(req): Json<CreateProjectRequest>,
) -> Result<Json<ProjectSchema>, ApiError> {
    let project = ProjectSchema::new(uuid::Uuid::new_v4().to_string(), req.name);
    state.set_project(project.clone()).await;
    Ok(Json(project))
}

/// Import project from JSON
#[derive(Debug, Deserialize)]
pub struct ImportProjectRequest {
    pub json: String,
}

pub async fn import_project(
    State(state): State<AppState>,
    Json(req): Json<ImportProjectRequest>,
) -> Result<Json<ProjectSchema>, ApiError> {
    let project = ProjectSchema::from_json(&req.json)
        .map_err(|e| ApiError::BadRequest(format!("Invalid JSON: {}", e)))?;
    state.set_project(project.clone()).await;
    Ok(Json(project))
}

/// Export project to JSON
pub async fn export_project(State(state): State<AppState>) -> Result<Json<String>, ApiError> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    let json = project
        .to_json()
        .map_err(|e| ApiError::Internal(format!("Serialization error: {}", e)))?;
    Ok(Json(json))
}

/// Set sync root folder
#[derive(Debug, Deserialize)]
pub struct SetSyncRootRequest {
    pub path: String,
}

pub async fn set_sync_root(
    State(state): State<AppState>,
    Json(req): Json<SetSyncRootRequest>,
) -> Result<Json<bool>, ApiError> {
    let mut project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    project.root_path = Some(req.path.clone());

    // Initialize structure
    let engine = crate::generator::sync_engine::SyncEngine::new(req.path.clone());
    engine
        .init_project_structure(&project)
        .map_err(|e| ApiError::Internal(format!("Sync init error: {}", e)))?;

    // Perform initial sync of all pages
    for page in &project.pages {
        if !page.archived {
            engine
                .sync_page_to_disk(&page.id, &project)
                .map_err(|e| ApiError::Internal(format!("Initial sync error: {}", e)))?;
        }
    }

    state.set_project(project).await;

    // Start file watcher
    let app_handle_opt = {
        let app_handle_lock = state.app_handle.lock().await;
        app_handle_lock.clone()
    };

    if let Some(app_handle) = app_handle_opt {
        let mut watcher = state.watcher.lock().await;
        if let Err(e) = watcher.watch(&req.path, app_handle) {
            log::error!("Failed to start file watcher: {}", e);
        }
    } else {
        log::warn!("App handle not available, skipping watcher start");
    }

    Ok(Json(true))
}

/// Trigger manual sync to disk
pub async fn trigger_sync(State(state): State<AppState>) -> Result<Json<bool>, ApiError> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let root = project
        .root_path
        .as_ref()
        .ok_or_else(|| ApiError::BadRequest("No sync root set".into()))?;

    let engine = crate::generator::sync_engine::SyncEngine::new(root);

    // Sync all pages
    for page in &project.pages {
        if !page.archived {
            engine
                .sync_page_to_disk(&page.id, &project)
                .map_err(|e| ApiError::Internal(format!("Sync error: {}", e)))?;
        }
    }

    Ok(Json(true))
}

/// Sync disk changes back to project memory
pub async fn sync_disk_to_memory(State(state): State<AppState>) -> Result<Json<bool>, ApiError> {
    let mut project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let root = project
        .root_path
        .as_ref()
        .ok_or_else(|| ApiError::BadRequest("No sync root set".into()))?;

    let engine = crate::generator::sync_engine::SyncEngine::new(root);

    engine
        .sync_disk_to_project(&mut project)
        .map_err(|e| ApiError::Internal(format!("Sync error: {}", e)))?;

    state.set_project(project).await;
    Ok(Json(true))
}

/// Rename project request
#[derive(Debug, Deserialize)]
pub struct RenameProjectRequest {
    pub name: String,
}

/// Rename current project
pub async fn rename_project(
    State(state): State<AppState>,
    Json(req): Json<RenameProjectRequest>,
) -> Result<Json<ProjectSchema>, ApiError> {
    let mut project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let _old_name = project.name.clone();
    let old_root = project.root_path.clone();

    project.name = req.name.clone();
    project.touch();

    // If root_path is set, try to rename the folder on disk too
    if let Some(old_path_str) = old_root {
        let old_path = std::path::PathBuf::from(&old_path_str);
        if old_path.exists() {
            // Calculate new path (parent of old path + new name)
            if let Some(parent) = old_path.parent() {
                let new_path = parent.join(&req.name);
                let new_path_str = new_path.to_string_lossy().to_string();

                log::info!(
                    "Renaming project folder from {:?} to {:?}",
                    old_path,
                    new_path
                );

                // Stop watcher before renaming
                {
                    let mut watcher = state.watcher.lock().await;
                    watcher.unwatch();
                }

                if let Err(e) = std::fs::rename(&old_path, &new_path) {
                    log::error!("Failed to rename project folder on disk: {}", e);
                    // We continue anyway so the project name is at least updated in DB
                } else {
                    project.root_path = Some(new_path_str.replace('\\', "/"));

                    // Restart watcher on new path
                    let app_handle_opt = {
                        let app_handle_lock = state.app_handle.lock().await;
                        app_handle_lock.clone()
                    };

                    if let Some(app_handle) = app_handle_opt {
                        let mut watcher = state.watcher.lock().await;
                        if let Err(e) =
                            watcher.watch(project.root_path.as_ref().unwrap(), app_handle)
                        {
                            log::error!("Failed to restart watcher after rename: {}", e);
                        }
                    }
                }
            }
        }
    }

    state.set_project(project.clone()).await;
    Ok(Json(project))
}

/// Reset project request
#[derive(Debug, Deserialize)]
pub struct ResetProjectRequest {
    pub clear_disk_files: Option<bool>,
}

/// Reset current project
pub async fn reset_project(
    State(state): State<AppState>,
    body: Option<Json<ResetProjectRequest>>,
) -> Result<Json<ProjectSchema>, ApiError> {
    let current = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    // Optionally clear disk files before resetting
    let should_clear_disk = body
        .map(|b| b.0.clear_disk_files.unwrap_or(false))
        .unwrap_or(false);

    if should_clear_disk {
        if let Some(root_path) = &current.root_path {
            let path = std::path::PathBuf::from(root_path);
            if path.exists() {
                // Stop watcher before wiping disk
                {
                    let mut watcher = state.watcher.lock().await;
                    watcher.unwatch();
                }

                // Remove all contents but keep the root folder
                for entry in std::fs::read_dir(&path).map_err(|e| {
                    ApiError::Internal(format!("Failed to read project folder: {}", e))
                })? {
                    let entry = entry.map_err(|e| {
                        ApiError::Internal(format!("Failed to read directory entry: {}", e))
                    })?;
                    let entry_path = entry.path();
                    if entry_path.is_dir() {
                        std::fs::remove_dir_all(&entry_path).map_err(|e| {
                            ApiError::Internal(format!("Failed to delete subfolder: {}", e))
                        })?;
                    } else {
                        std::fs::remove_file(&entry_path).map_err(|e| {
                            ApiError::Internal(format!("Failed to delete file: {}", e))
                        })?;
                    }
                }
            }
        }
    }

    // Create a fresh project with same ID and name
    let mut new_project = ProjectSchema::new(current.id, current.name);

    // Preserve root path if it exists
    new_project.root_path = current.root_path.clone();

    // Auto-sync the empty state to disk if root path exists
    if let Some(root) = &new_project.root_path {
        let engine = crate::generator::sync_engine::SyncEngine::new(root);

        // Re-init structure (creates fresh boilerplate)
        engine
            .init_project_structure(&new_project)
            .map_err(|e| ApiError::Internal(format!("Reset sync error: {}", e)))?;

        // Restart watcher on reset path
        let app_handle_opt = {
            let app_handle_lock = state.app_handle.lock().await;
            app_handle_lock.clone()
        };

        if let Some(app_handle) = app_handle_opt {
            let mut watcher = state.watcher.lock().await;
            if let Err(e) = watcher.watch(root, app_handle) {
                log::error!("Failed to restart watcher after reset: {}", e);
            }
        }

        // Sync the default Home page
        for page in &new_project.pages {
            engine
                .sync_page_to_disk(&page.id, &new_project)
                .map_err(|e| ApiError::Internal(format!("Sync page reset error: {}", e)))?;
        }
    }

    state.set_project(new_project.clone()).await;
    Ok(Json(new_project))
}

/// Installation step result
#[derive(Debug, Serialize)]
pub struct InstallStep {
    pub target: String,
    pub success: bool,
    pub timed_out: bool,
    pub duration_ms: u64,
    pub stdout: String,
    pub stderr: String,
    pub status: String,
}

/// Installation summary
#[derive(Debug, Serialize)]
pub struct InstallResult {
    pub success: bool,
    pub steps: Vec<InstallStep>,
}

fn run_npm_install_step(target: &str, path: PathBuf) -> InstallStep {
    let start = Instant::now();

    if !path.exists() {
        return InstallStep {
            target: target.to_string(),
            success: false,
            timed_out: false,
            duration_ms: start.elapsed().as_millis() as u64,
            stdout: String::new(),
            stderr: format!("Directory not found: {}", path.display()),
            status: "failed".into(),
        };
    }

    if !path.join("package.json").exists() {
        return InstallStep {
            target: target.to_string(),
            success: true,
            timed_out: false,
            duration_ms: start.elapsed().as_millis() as u64,
            stdout: "Skipped: package.json not found".into(),
            stderr: String::new(),
            status: "skipped".into(),
        };
    }

    let output = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", "npm", "install", "--no-audit", "--no-fund"])
            .current_dir(&path)
            .output()
    } else {
        Command::new("npm")
            .args(["install", "--no-audit", "--no-fund"])
            .current_dir(&path)
            .output()
    };

    match output {
        Ok(result) => {
            let success = result.status.success();
            InstallStep {
                target: target.to_string(),
                success,
                timed_out: false,
                duration_ms: start.elapsed().as_millis() as u64,
                stdout: String::from_utf8_lossy(&result.stdout).to_string(),
                stderr: String::from_utf8_lossy(&result.stderr).to_string(),
                status: if success {
                    "success".into()
                } else {
                    "failed".into()
                },
            }
        }
        Err(err) => InstallStep {
            target: target.to_string(),
            success: false,
            timed_out: false,
            duration_ms: start.elapsed().as_millis() as u64,
            stdout: String::new(),
            stderr: format!("Failed to run npm install: {}", err),
            status: "failed".into(),
        },
    }
}

/// Install dependencies for both client and server
pub async fn install_project_dependencies(
    State(state): State<AppState>,
) -> Result<Json<InstallResult>, ApiError> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let root = project
        .root_path
        .ok_or_else(|| ApiError::BadRequest("Project root path not set".into()))?;

    let root_path = PathBuf::from(root);
    let steps = vec![
        run_npm_install_step("client", root_path.join("client")),
        run_npm_install_step("server", root_path.join("server")),
    ];

    let success = steps.iter().all(|step| step.success);
    Ok(Json(InstallResult { success, steps }))
}

// ===================== Update Project Settings =====================

/// Update project settings (theme, build, seo)
#[derive(Debug, Deserialize)]
pub struct UpdateSettingsRequest {
    pub settings: serde_json::Value,
}

pub async fn update_settings(
    State(state): State<AppState>,
    Json(req): Json<UpdateSettingsRequest>,
) -> Result<Json<ProjectSchema>, ApiError> {
    let mut project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    // Merge incoming settings into existing settings
    let mut current = serde_json::to_value(&project.settings).unwrap_or_default();
    if let (Some(cur_obj), Some(new_obj)) = (current.as_object_mut(), req.settings.as_object()) {
        for (k, v) in new_obj {
            // Support nested merge for theme, build, seo
            if let (Some(existing), Some(incoming)) = (
                cur_obj.get_mut(k).and_then(|x| x.as_object_mut()),
                v.as_object(),
            ) {
                for (ik, iv) in incoming {
                    existing.insert(ik.clone(), iv.clone());
                }
            } else {
                cur_obj.insert(k.clone(), v.clone());
            }
        }
    }
    project.settings = serde_json::from_value(current).unwrap_or_default();
    project.touch();
    state.set_project(project.clone()).await;

    Ok(Json(project))
}
