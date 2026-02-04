//! Block routes

use axum::{
    extract::{State, Path},
    Json,
};
use serde::Deserialize;

use crate::backend::state::AppState;
use crate::backend::error::ApiError;
use crate::schema::{BlockSchema, BlockType};

/// Add block request
#[derive(Debug, Deserialize)]
pub struct AddBlockRequest {
    pub block_type: String,
    pub name: String,
    pub parent_id: Option<String>,
}

/// Update block request
#[derive(Debug, Deserialize)]
pub struct UpdateBlockRequest {
    pub property: String,
    pub value: serde_json::Value,
}

/// Add a new block
pub async fn add_block(
    State(state): State<AppState>,
    Json(req): Json<AddBlockRequest>,
) -> Result<Json<BlockSchema>, ApiError> {
    let mut project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let block_type = match req.block_type.as_str() {
        "container" => BlockType::Container,
        "text" => BlockType::Text,
        "heading" => BlockType::Heading,
        "button" => BlockType::Button,
        "image" => BlockType::Image,
        "input" => BlockType::Input,
        "form" => BlockType::Form,
        "link" => BlockType::Link,
        "section" => BlockType::Section,
        "columns" => BlockType::Columns,
        "column" => BlockType::Column,
        "flex" => BlockType::Flex,
        "grid" => BlockType::Grid,
        _ => BlockType::Custom(req.block_type.clone()),
    };
    
    let mut block = BlockSchema::new(
        uuid::Uuid::new_v4().to_string(),
        block_type,
        &req.name,
    );
    
    if let Some(parent_id) = req.parent_id {
        block.parent_id = Some(parent_id);
    }
    
    let result = block.clone();
    project.add_block(block);
    
    // Auto-sync
    if let Some(root) = &project.root_path {
        let engine = crate::generator::sync_engine::SyncEngine::new(root);
        let _ = engine.sync_page_to_disk_by_block(&result.id, &project);
    }
    
    state.set_project(project).await;
    
    Ok(Json(result))
}

/// Update a block
pub async fn update_block(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<UpdateBlockRequest>,
) -> Result<Json<BlockSchema>, ApiError> {
    let mut project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let block = project.find_block_mut(&id)
        .ok_or_else(|| ApiError::NotFound(format!("Block {} not found", id)))?;
    
    // Check if we are updating a style
    if req.property.starts_with("styles.") {
        let style_name = &req.property[7..];
        
        let style_value = match req.value {
            serde_json::Value::String(s) => crate::schema::block::StyleValue::String(s),
            serde_json::Value::Number(n) => crate::schema::block::StyleValue::Number(n.as_f64().unwrap_or(0.0)),
            serde_json::Value::Bool(b) => crate::schema::block::StyleValue::Boolean(b),
            _ => return Err(ApiError::BadRequest(format!("Invalid style value for {}", style_name))),
        };
        
        block.styles.insert(style_name.to_string(), style_value);
    } else {
        // Update property based on name
        match req.property.as_str() {
            "name" => {
                if let Some(name) = req.value.as_str() {
                    block.name = name.to_string();
                }
            }
            "content" => {
                if let Some(content) = req.value.as_str() {
                    block.properties.insert("content".into(), serde_json::json!(content));
                }
            }
            _ => {
                block.properties.insert(req.property.clone(), req.value);
            }
        }
    }
    
    let result = block.clone();
    
    // Auto-sync
    if let Some(root) = &project.root_path {
        let engine = crate::generator::sync_engine::SyncEngine::new(root);
        let _ = engine.sync_page_to_disk_by_block(&id, &project);
    }
    
    state.set_project(project).await;
    Ok(Json(result))
}

/// Delete (archive) a block
pub async fn delete_block(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<bool>, ApiError> {
    let mut project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let success = project.archive_block(&id);
    
    // Auto-sync
    if let Some(root) = &project.root_path {
        let engine = crate::generator::sync_engine::SyncEngine::new(root);
        // Note: For archive, we might need to sync the page that contained it
        // but since it's already removed from the parent, we sync all pages to be safe
        // or better, the sync_to_disk helper.
        for page in &project.pages {
            if !page.archived {
                let _ = engine.sync_page_to_disk(&page.id, &project);
            }
        }
    }
    
    state.set_project(project).await;
    Ok(Json(success))
}
