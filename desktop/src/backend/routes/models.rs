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

/// Add a field to a data model
pub async fn add_field(
    State(state): State<AppState>,
    Path(model_id): Path<String>,
    Json(req): Json<AddFieldRequest>,
) -> Result<Json<DataModelSchema>, ApiError> {
    let mut project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let field_type = match req.field_type.as_str() {
        "int" => crate::schema::data_model::FieldType::Int,
        "float" => crate::schema::data_model::FieldType::Float,
        "boolean" => crate::schema::data_model::FieldType::Boolean,
        "datetime" => crate::schema::data_model::FieldType::DateTime,
        _ => crate::schema::data_model::FieldType::String,
    };
    
    let model = project.data_models.iter_mut()
        .find(|m| m.id == model_id)
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
