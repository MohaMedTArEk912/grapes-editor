//! Component routes

use axum::{
    extract::{Path, State},
    Json,
};
use serde::Deserialize;

use crate::backend::error::ApiError;
use crate::backend::state::AppState;
use crate::schema::{BlockSchema, BlockType};

/// Create component request
#[derive(Debug, Deserialize)]
pub struct CreateComponentRequest {
    pub name: String,
    pub description: Option<String>,
}

/// Create a new master component
pub async fn create_component(
    State(state): State<AppState>,
    Json(req): Json<CreateComponentRequest>,
) -> Result<Json<BlockSchema>, ApiError> {
    let mut project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    // Create a Container block as the component root
    let mut component = BlockSchema::new(
        uuid::Uuid::new_v4().to_string(),
        BlockType::Container,
        &req.name,
    );

    // Mark it as a component root?
    // We already know it's a component because it lives in the `components` list.
    // But maybe we want a property?
    if let Some(desc) = req.description {
        component
            .properties
            .insert("description".into(), serde_json::Value::String(desc));
    }

    let result = component.clone();

    project.add_component(component);

    // Sync?
    // TODO: Component sync logic

    state.set_project(project).await;

    Ok(Json(result))
}

/// List all components
pub async fn list_components(
    State(state): State<AppState>,
) -> Result<Json<Vec<BlockSchema>>, ApiError> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    // Return all blocks in the components list
    // Ideally we filter for just Roots?
    // Users might want to see the whole tree, or just the available components.
    // Usually "List Components" implies "List Definitions".
    // If `components` contains children, we should filter for roots (parent_id == None).

    let roots: Vec<BlockSchema> = project
        .components
        .iter()
        .filter(|c| c.parent_id.is_none() && !c.archived)
        .cloned()
        .collect();

    Ok(Json(roots))
}

/// Get a component by ID
pub async fn get_component(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<BlockSchema>, ApiError> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let component = project
        .find_component(&id)
        .ok_or_else(|| ApiError::NotFound(format!("Component {} not found", id)))?;

    Ok(Json(component.clone()))
}
