//! Project routes

use axum::{
    extract::State,
    Json,
};
use serde::Deserialize;

use crate::backend::state::AppState;
use crate::backend::error::ApiError;
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
    let project = ProjectSchema::new(
        uuid::Uuid::new_v4().to_string(),
        req.name,
    );
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
pub async fn export_project(
    State(state): State<AppState>,
) -> Result<Json<String>, ApiError> {
    let project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    let json = project.to_json()
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
    let mut project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    project.root_path = Some(req.path.clone());
    
    // Initialize structure
    let engine = crate::generator::sync_engine::SyncEngine::new(req.path);
    engine.init_project_structure(&project)
        .map_err(|e| ApiError::Internal(format!("Sync init error: {}", e)))?;
    
    // Perform initial sync of all pages
    for page in &project.pages {
        if !page.archived {
            engine.sync_page_to_disk(&page.id, &project)
                .map_err(|e| ApiError::Internal(format!("Initial sync error: {}", e)))?;
        }
    }
    
    state.set_project(project).await;
    Ok(Json(true))
}

/// Trigger manual sync to disk
pub async fn trigger_sync(
    State(state): State<AppState>,
) -> Result<Json<bool>, ApiError> {
    let project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let root = project.root_path.as_ref()
        .ok_or_else(|| ApiError::BadRequest("No sync root set".into()))?;
    
    let engine = crate::generator::sync_engine::SyncEngine::new(root);
    
    // Sync all pages
    for page in &project.pages {
        if !page.archived {
            engine.sync_page_to_disk(&page.id, &project)
                .map_err(|e| ApiError::Internal(format!("Sync error: {}", e)))?;
        }
    }
    
    Ok(Json(true))
}

/// Sync disk changes back to project memory
pub async fn sync_disk_to_memory(
    State(state): State<AppState>,
) -> Result<Json<bool>, ApiError> {
    let mut project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let root = project.root_path.as_ref()
        .ok_or_else(|| ApiError::BadRequest("No sync root set".into()))?;
    
    let engine = crate::generator::sync_engine::SyncEngine::new(root);
    
    engine.sync_disk_to_project(&mut project)
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
    let mut project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    project.name = req.name;
    project.touch();
    
    state.set_project(project.clone()).await;
    Ok(Json(project))
}

/// Reset current project
pub async fn reset_project(
    State(state): State<AppState>,
) -> Result<Json<ProjectSchema>, ApiError> {
    let current = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    // Create a fresh project with same ID and name
    let mut new_project = ProjectSchema::new(current.id, current.name);
    
    // Preserve root path if it exists
    new_project.root_path = current.root_path.clone();
    
    // Auto-sync the empty state to disk if root path exists
    if let Some(root) = &new_project.root_path {
        let engine = crate::generator::sync_engine::SyncEngine::new(root);
        
        // Re-init structure (clears config)
        engine.init_project_structure(&new_project)
            .map_err(|e| ApiError::Internal(format!("Sync reset error: {}", e)))?;
            
        // Sync the default Home page (clears existing code)
        for page in &new_project.pages {
            engine.sync_page_to_disk(&page.id, &new_project)
                .map_err(|e| ApiError::Internal(format!("Sync page reset error: {}", e)))?;
        }
    }
    
    state.set_project(new_project.clone()).await;
    Ok(Json(new_project))
}
