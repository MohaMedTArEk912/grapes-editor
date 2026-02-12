//! Page routes

use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Serialize};

use crate::backend::error::ApiError;
use crate::backend::state::AppState;
use crate::schema::PageSchema;

/// Update page request
#[derive(Debug, Deserialize)]
pub struct UpdatePageRequest {
    pub name: Option<String>,
    pub path: Option<String>,
}

/// Add page request
#[derive(Debug, Deserialize)]
pub struct AddPageRequest {
    pub name: String,
    pub path: String,
}

/// Page content response
#[derive(Debug, Serialize)]
pub struct PageContentResponse {
    pub content: String,
}

/// Add a new page
pub async fn add_page(
    State(state): State<AppState>,
    Json(req): Json<AddPageRequest>,
) -> Result<Json<PageSchema>, ApiError> {
    let mut project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let page = PageSchema::new(uuid::Uuid::new_v4().to_string(), &req.name, &req.path);

    let result = page.clone();
    project.add_page(page);

    // Auto-sync
    if let Some(root) = &project.root_path {
        let engine = crate::generator::sync_engine::SyncEngine::new(root);
        let _ = engine.sync_page_to_disk(&result.id, &project);
    }

    state.set_project(project).await;

    Ok(Json(result))
}

/// Update a page
pub async fn update_page(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<UpdatePageRequest>,
) -> Result<Json<PageSchema>, ApiError> {
    let mut project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let mut page = project
        .find_page(&id)
        .ok_or_else(|| ApiError::NotFound("Page not found".into()))?
        .clone();

    if let Some(name) = req.name {
        page.name = name;
    }
    if let Some(path) = req.path {
        page.path = path;
    }

    project.update_page(page.clone());
    state.set_project(project).await;

    Ok(Json(page))
}

/// Delete a page (soft delete/archive)
pub async fn delete_page(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<bool>, ApiError> {
    let mut project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    // Find page name before archiving for disk deletion
    let page_name = project.find_page(&id).map(|p| p.name.clone());

    project.archive_page(&id);

    // Auto-sync deletion
    if let (Some(root), Some(name)) = (&project.root_path, page_name) {
        let engine = crate::generator::sync_engine::SyncEngine::new(root);
        let _ = engine.delete_page_from_disk(&name, &project);
    }

    state.set_project(project).await;

    Ok(Json(true))
}

/// Get physical page content from disk
pub async fn get_page_content(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<PageContentResponse>, ApiError> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let page = project
        .find_page(&id)
        .ok_or_else(|| ApiError::NotFound("Page not found".into()))?;

    let root_path = project.root_path.as_ref().ok_or_else(|| {
        ApiError::BadRequest("Project root path not set. Please set it in project settings.".into())
    })?;

    // Map page to client/src/pages folder (logic from sync_engine.rs)
    let file_name = format!("{}.tsx", crate::generator::pascal_case(&page.name));
    let mut tsx_path = std::path::PathBuf::from(root_path)
        .join("client/src/pages")
        .join(&file_name);

    // Backward compatibility for older projects synced to client/page.
    if !tsx_path.exists() {
        tsx_path = std::path::PathBuf::from(root_path)
            .join("client/page")
            .join(file_name);
    }

    if !tsx_path.exists() {
        return Err(ApiError::NotFound(format!(
            "File not found at {:?}",
            tsx_path
        )));
    }

    let content = std::fs::read_to_string(tsx_path)
        .map_err(|e| ApiError::Internal(format!("Failed to read file: {}", e)))?;

    Ok(Json(PageContentResponse { content }))
}
