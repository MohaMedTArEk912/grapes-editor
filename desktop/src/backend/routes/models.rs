//! Data model routes

use axum::{
    extract::{State, Path},
    Json,
};
use serde::Deserialize;

use crate::backend::state::AppState;
use crate::backend::error::ApiError;
use crate::schema::DataModelSchema;

/// Add model request
#[derive(Debug, Deserialize)]
pub struct AddModelRequest {
    pub name: String,
}

/// Add field request
#[derive(Debug, Deserialize)]
pub struct AddFieldRequest {
    pub name: String,
    pub field_type: String,
    pub required: bool,
}

/// Update model request
#[derive(Debug, Deserialize)]
pub struct UpdateModelRequest {
    pub name: Option<String>,
    pub description: Option<String>,
}

/// Update field request
#[derive(Debug, Deserialize)]
pub struct UpdateFieldRequest {
    pub name: Option<String>,
    pub field_type: Option<String>,
    pub required: Option<bool>,
    pub unique: Option<bool>,
    pub description: Option<String>,
}

/// Get all data models
pub async fn get_models(
    State(state): State<AppState>,
) -> Result<Json<Vec<DataModelSchema>>, ApiError> {
    let project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let models: Vec<DataModelSchema> = project.data_models.iter()
        .filter(|m| !m.archived)
        .cloned()
        .collect();
    
    Ok(Json(models))
}

/// Add a new data model
pub async fn add_model(
    State(state): State<AppState>,
    Json(req): Json<AddModelRequest>,
) -> Result<Json<DataModelSchema>, ApiError> {
    let mut project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let model = DataModelSchema::new(
        uuid::Uuid::new_v4().to_string(),
        &req.name,
    );
    
    let result = model.clone();
    project.add_data_model(model);
    state.set_project(project).await;
    
    Ok(Json(result))
}

/// Update a data model
pub async fn update_model(
    State(state): State<AppState>,
    Path(model_id): Path<String>,
    Json(req): Json<UpdateModelRequest>,
) -> Result<Json<DataModelSchema>, ApiError> {
    let mut project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let model = project.data_models.iter_mut()
        .find(|m| m.id == model_id && !m.archived)
        .ok_or_else(|| ApiError::NotFound(format!("Model '{}' not found", model_id)))?;
    
    if let Some(name) = req.name {
        model.name = name;
    }
    if let Some(description) = req.description {
        model.description = Some(description);
    }
    
    let result = model.clone();
    state.set_project(project).await;
    
    Ok(Json(result))
}

/// Delete a data model (archive)
pub async fn delete_model(
    State(state): State<AppState>,
    Path(model_id): Path<String>,
) -> Result<Json<bool>, ApiError> {
    let mut project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let mut found = false;
    for model in project.data_models.iter_mut() {
        if model.id == model_id {
            model.archived = true;
            found = true;
            break;
        }
    }
    
    if found {
        state.set_project(project).await;
    }
    
    Ok(Json(found))
}

/// Add a field to a data model
pub async fn add_field(
    State(state): State<AppState>,
    Path(model_id): Path<String>,
    Json(req): Json<AddFieldRequest>,
) -> Result<Json<DataModelSchema>, ApiError> {
    let mut project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let field_type = parse_field_type(&req.field_type)?;
    
    let model = project.data_models.iter_mut()
        .find(|m| m.id == model_id && !m.archived)
        .ok_or_else(|| ApiError::NotFound("Model not found".into()))?;
    
    let field = crate::schema::data_model::FieldSchema {
        id: uuid::Uuid::new_v4().to_string(),
        name: req.name,
        field_type,
        required: req.required,
        primary_key: false,
        unique: false,
        default_value: None,
        validations: Vec::new(),
        description: None,
    };
    
    model.fields.push(field);
    let result = model.clone();
    
    state.set_project(project).await;
    
    Ok(Json(result))
}

/// Update a field in a data model
pub async fn update_field(
    State(state): State<AppState>,
    Path((model_id, field_id)): Path<(String, String)>,
    Json(req): Json<UpdateFieldRequest>,
) -> Result<Json<DataModelSchema>, ApiError> {
    let mut project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let model = project.data_models.iter_mut()
        .find(|m| m.id == model_id && !m.archived)
        .ok_or_else(|| ApiError::NotFound(format!("Model '{}' not found", model_id)))?;
    
    let field = model.fields.iter_mut()
        .find(|f| f.id == field_id)
        .ok_or_else(|| ApiError::NotFound(format!("Field '{}' not found", field_id)))?;
    
    if let Some(name) = req.name {
        field.name = name;
    }
    if let Some(field_type_str) = &req.field_type {
        field.field_type = parse_field_type(field_type_str)?;
    }
    if let Some(required) = req.required {
        field.required = required;
    }
    if let Some(unique) = req.unique {
        field.unique = unique;
    }
    if let Some(description) = req.description {
        field.description = Some(description);
    }
    
    let result = model.clone();
    state.set_project(project).await;
    
    Ok(Json(result))
}

/// Delete a field from a data model
pub async fn delete_field(
    State(state): State<AppState>,
    Path((model_id, field_id)): Path<(String, String)>,
) -> Result<Json<DataModelSchema>, ApiError> {
    let mut project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let model = project.data_models.iter_mut()
        .find(|m| m.id == model_id && !m.archived)
        .ok_or_else(|| ApiError::NotFound(format!("Model '{}' not found", model_id)))?;
    
    let original_len = model.fields.len();
    model.fields.retain(|f| f.id != field_id);
    
    if model.fields.len() == original_len {
        return Err(ApiError::NotFound(format!("Field '{}' not found", field_id)));
    }
    
    let result = model.clone();
    state.set_project(project).await;
    
    Ok(Json(result))
}

/// Add a relation to a data model
#[derive(Debug, Deserialize)]
pub struct AddRelationRequest {
    pub name: String,
    pub target_model_id: String,
    pub relation_type: String,
}

pub async fn add_relation(
    State(state): State<AppState>,
    Path(model_id): Path<String>,
    Json(req): Json<AddRelationRequest>,
) -> Result<Json<DataModelSchema>, ApiError> {
    let mut project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let relation_type = match req.relation_type.to_lowercase().as_str() {
        "onetoone" | "one_to_one" => crate::schema::data_model::RelationType::OneToOne,
        "onetomany" | "one_to_many" => crate::schema::data_model::RelationType::OneToMany,
        "manytoone" | "many_to_one" => crate::schema::data_model::RelationType::ManyToOne,
        "manytomany" | "many_to_many" => crate::schema::data_model::RelationType::ManyToMany,
        other => return Err(ApiError::BadRequest(format!("Unknown relation type: '{}'. Use: oneToOne, oneToMany, manyToOne, manyToMany", other))),
    };
    
    // Verify target model exists
    let target_exists = project.data_models.iter()
        .any(|m| m.id == req.target_model_id && !m.archived);
    if !target_exists {
        return Err(ApiError::NotFound(format!("Target model '{}' not found", req.target_model_id)));
    }
    
    let model = project.data_models.iter_mut()
        .find(|m| m.id == model_id && !m.archived)
        .ok_or_else(|| ApiError::NotFound(format!("Model '{}' not found", model_id)))?;
    
    let relation = crate::schema::data_model::RelationSchema {
        id: uuid::Uuid::new_v4().to_string(),
        name: req.name,
        target_model_id: req.target_model_id,
        relation_type,
        foreign_key: None,
        on_delete: crate::schema::data_model::OnDeleteAction::SetNull,
        on_update: crate::schema::data_model::OnUpdateAction::Cascade,
    };
    
    model.relations.push(relation);
    let result = model.clone();
    state.set_project(project).await;
    
    Ok(Json(result))
}

/// Delete a relation from a data model
pub async fn delete_relation(
    State(state): State<AppState>,
    Path((model_id, relation_id)): Path<(String, String)>,
) -> Result<Json<DataModelSchema>, ApiError> {
    let mut project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let model = project.data_models.iter_mut()
        .find(|m| m.id == model_id && !m.archived)
        .ok_or_else(|| ApiError::NotFound(format!("Model '{}' not found", model_id)))?;
    
    let original_len = model.relations.len();
    model.relations.retain(|r| r.id != relation_id);
    
    if model.relations.len() == original_len {
        return Err(ApiError::NotFound(format!("Relation '{}' not found", relation_id)));
    }
    
    let result = model.clone();
    state.set_project(project).await;
    
    Ok(Json(result))
}

/// Parse field type string to enum
fn parse_field_type(s: &str) -> Result<crate::schema::data_model::FieldType, ApiError> {
    match s.to_lowercase().as_str() {
        "string" => Ok(crate::schema::data_model::FieldType::String),
        "int" => Ok(crate::schema::data_model::FieldType::Int),
        "float" => Ok(crate::schema::data_model::FieldType::Float),
        "boolean" => Ok(crate::schema::data_model::FieldType::Boolean),
        "datetime" => Ok(crate::schema::data_model::FieldType::DateTime),
        "json" => Ok(crate::schema::data_model::FieldType::Json),
        "uuid" => Ok(crate::schema::data_model::FieldType::Uuid),
        "email" => Ok(crate::schema::data_model::FieldType::Email),
        "url" => Ok(crate::schema::data_model::FieldType::Url),
        "bytes" => Ok(crate::schema::data_model::FieldType::Bytes),
        "text" => Ok(crate::schema::data_model::FieldType::Text),
        other => Err(ApiError::BadRequest(format!("Unknown field type: '{}'. Supported: string, int, float, boolean, datetime, json, uuid, email, url, bytes, text", other))),
    }
}
