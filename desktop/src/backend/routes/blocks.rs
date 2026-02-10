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
    pub page_id: Option<String>,
}

/// Update block request
#[derive(Debug, Deserialize)]
pub struct UpdateBlockRequest {
    pub property: String,
    pub value: serde_json::Value,
}

/// Move block request
#[derive(Debug, Deserialize)]
pub struct MoveBlockRequest {
    /// New parent block ID (None = move to root level)
    pub new_parent_id: Option<String>,
    /// Index within the new parent's children list
    pub index: usize,
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
    
    if let Some(parent_id) = &req.parent_id {
        block.parent_id = Some(parent_id.clone());
    }
    
    let block_id = block.id.clone();
    let result = block.clone();
    
    // 1. Add to project flat list
    project.add_block(block);
    
    // 2. Link to parent if provided
    if let Some(parent_id) = &req.parent_id {
        if let Some(parent) = project.find_block_mut(parent_id) {
            if !parent.children.contains(&block_id) {
                parent.children.push(block_id.clone());
            }
        }
    } 
    // 3. Link to page root if no parent but page_id provided
    else if let Some(page_id) = &req.page_id {
        let mut attached_to_root = false;
        let mut existing_root_id = None;
        
        if let Some(page) = project.find_page_mut(page_id) {
            if let Some(root_id) = &page.root_block_id {
                existing_root_id = Some(root_id.clone());
            } else {
                page.root_block_id = Some(block_id.clone());
                attached_to_root = true;
            }
        }
        
        if !attached_to_root {
            if let Some(root_id) = existing_root_id {
                // Use a block to scope the borrow 
                {
                    if let Some(root_block) = project.find_block_mut(&root_id) {
                        root_block.children.push(block_id.clone());
                    }
                }
                
                if let Some(new_block) = project.find_block_mut(&block_id) {
                    new_block.parent_id = Some(root_id);
                }
            }
        }
    }
    
    // Auto-sync
    if let Some(root) = &project.root_path {
        let engine = crate::generator::sync_engine::SyncEngine::new(root);
        if let Err(e) = engine.sync_page_to_disk_by_block(&result.id, &project) {
            log::error!("Auto-sync failed for block {}: {}", result.id, e);
        }
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
    } else if req.property.starts_with("bindings.") {
        // Update a single binding: bindings.propertyName -> DataBinding
        let binding_key = &req.property[9..];
        if req.value.is_null() {
            block.bindings.remove(binding_key);
        } else {
            match serde_json::from_value::<crate::schema::block::DataBinding>(req.value) {
                Ok(binding) => { block.bindings.insert(binding_key.to_string(), binding); }
                Err(e) => return Err(ApiError::BadRequest(format!("Invalid binding value: {}", e))),
            }
        }
    } else if req.property == "bindings" {
        // Replace all bindings at once
        match serde_json::from_value::<std::collections::HashMap<String, crate::schema::block::DataBinding>>(req.value) {
            Ok(bindings) => { block.bindings = bindings; }
            Err(e) => return Err(ApiError::BadRequest(format!("Invalid bindings: {}", e))),
        }
    } else if req.property.starts_with("events.") {
        // Update a single event: events.eventName -> logic_flow_id
        let event_name = &req.property[7..];
        if req.value.is_null() {
            block.events.remove(event_name);
        } else if let Some(flow_id) = req.value.as_str() {
            block.events.insert(event_name.to_string(), flow_id.to_string());
        }
    } else if req.property == "events" {
        // Replace all events at once
        match serde_json::from_value::<std::collections::HashMap<String, String>>(req.value) {
            Ok(events) => { block.events = events; }
            Err(e) => return Err(ApiError::BadRequest(format!("Invalid events: {}", e))),
        }
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
        if let Err(e) = engine.sync_page_to_disk_by_block(&id, &project) {
            log::error!("Auto-sync failed for block {}: {}", id, e);
        }
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

    // 1. Remove from parent's children if linked
    let mut parent_id_to_sync = None;
    let mut page_id_to_sync = None;

    if let Some(block) = project.find_block(&id) {
        if let Some(parent_id) = &block.parent_id {
            parent_id_to_sync = Some(parent_id.clone());
        }
    }

    if let Some(parent_id) = &parent_id_to_sync {
        if let Some(parent) = project.find_block_mut(parent_id) {
            parent.children.retain(|cid| cid != &id);
        }
    } else {
        // If it's not in a parent, it might be a page root
        for page in project.pages.iter_mut() {
            if page.root_block_id.as_ref() == Some(&id) {
                page.root_block_id = None;
                page_id_to_sync = Some(page.id.clone());
                break;
            }
        }
    }

    // 2. Archive the block
    let success = project.archive_block(&id);

    // Auto-sync
    if let Some(root) = &project.root_path {
        let engine = crate::generator::sync_engine::SyncEngine::new(root);

        if let Some(pid) = parent_id_to_sync {
            if let Err(e) = engine.sync_page_to_disk_by_block(&pid, &project) {
                log::error!("Auto-sync failed after block delete: {}", e);
            }
        } else if let Some(pgid) = page_id_to_sync {
            if let Err(e) = engine.sync_page_to_disk(&pgid, &project) {
                log::error!("Auto-sync failed after block delete: {}", e);
            }
        } else {
            for page in &project.pages {
                if !page.archived {
                    if let Err(e) = engine.sync_page_to_disk(&page.id, &project) {
                        log::error!("Auto-sync failed for page {}: {}", page.id, e);
                    }
                }
            }
        }
    }
    
    state.set_project(project).await;
    Ok(Json(success))
}

/// Move a block to a new parent and/or reorder it
pub async fn move_block(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<MoveBlockRequest>,
) -> Result<Json<bool>, ApiError> {
    let mut project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    // Verify block exists
    let old_parent_id = {
        let block = project.find_block(&id)
            .ok_or_else(|| ApiError::NotFound(format!("Block {} not found", id)))?;
        block.parent_id.clone()
    };

    // 1. Remove from old parent's children
    if let Some(ref old_pid) = old_parent_id {
        if let Some(parent) = project.find_block_mut(old_pid) {
            parent.children.retain(|cid| cid != &id);
        }
    }

    // 2. Insert into new parent's children at the requested index
    if let Some(ref new_pid) = req.new_parent_id {
        if let Some(new_parent) = project.find_block_mut(new_pid) {
            new_parent.children.retain(|cid| cid != &id);
            let idx = req.index.min(new_parent.children.len());
            new_parent.children.insert(idx, id.clone());
        } else {
            return Err(ApiError::NotFound(format!("New parent {} not found", new_pid)));
        }
    }

    // 3. Update the block's parent_id
    if let Some(block) = project.find_block_mut(&id) {
        block.parent_id = req.new_parent_id.clone();
    }

    // 4. Auto-sync affected pages
    if let Some(root) = &project.root_path {
        let engine = crate::generator::sync_engine::SyncEngine::new(root);
        for page in &project.pages {
            if !page.archived {
                if let Err(e) = engine.sync_page_to_disk(&page.id, &project) {
                    log::error!("Auto-sync failed for page {}: {}", page.id, e);
                }
            }
        }
    }

    state.set_project(project).await;
    Ok(Json(true))
}
