//! Variable routes - CRUD for state variables

use axum::{
    extract::{State, Path},
    Json,
};
use serde::Deserialize;
use serde_json::Value;

use crate::backend::state::AppState;
use crate::backend::error::ApiError;
use crate::schema::variable::{VariableSchema, VariableType, VariableScope};

#[derive(Debug, Deserialize)]
pub struct CreateVariableRequest {
    pub name: String,
    pub var_type: String,
    pub default_value: Option<Value>,
    pub scope: Option<String>,
    pub page_id: Option<String>,
    pub description: Option<String>,
    pub persist: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateVariableRequest {
    pub name: Option<String>,
    pub var_type: Option<String>,
    pub default_value: Option<Value>,
    pub scope: Option<String>,
    pub page_id: Option<String>,
    pub description: Option<String>,
    pub persist: Option<bool>,
}

/// Get all variables
pub async fn get_variables(
    State(state): State<AppState>,
) -> Result<Json<Vec<VariableSchema>>, ApiError> {
    let project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let vars: Vec<VariableSchema> = project.variables.iter()
        .filter(|v| !v.archived)
        .cloned()
        .collect();
    
    Ok(Json(vars))
}

/// Create a new variable
pub async fn create_variable(
    State(state): State<AppState>,
    Json(req): Json<CreateVariableRequest>,
) -> Result<Json<VariableSchema>, ApiError> {
    let mut project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let var_type = parse_var_type(&req.var_type)?;
    let default_value = req.default_value.unwrap_or(default_for_type(&var_type));
    let scope = parse_scope(req.scope.as_deref(), req.page_id.as_deref())?;
    
    let mut var = VariableSchema::new(
        uuid::Uuid::new_v4().to_string(),
        req.name,
        var_type,
        default_value,
    );
    var.scope = scope;
    var.description = req.description;
    var.persist = req.persist.unwrap_or(false);
    
    let result = var.clone();
    project.variables.push(var);
    state.set_project(project).await;
    
    Ok(Json(result))
}

/// Update a variable
pub async fn update_variable(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<UpdateVariableRequest>,
) -> Result<Json<VariableSchema>, ApiError> {
    let mut project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let var = project.variables.iter_mut()
        .find(|v| v.id == id && !v.archived)
        .ok_or_else(|| ApiError::NotFound(format!("Variable '{}' not found", id)))?;
    
    if let Some(name) = req.name {
        var.name = name;
    }
    if let Some(var_type_str) = &req.var_type {
        var.var_type = parse_var_type(var_type_str)?;
    }
    if let Some(default_value) = req.default_value {
        var.default_value = default_value;
    }
    if let Some(scope_str) = req.scope.as_deref() {
        var.scope = parse_scope(Some(scope_str), req.page_id.as_deref())?;
    }
    if let Some(description) = req.description {
        var.description = Some(description);
    }
    if let Some(persist) = req.persist {
        var.persist = persist;
    }
    
    let result = var.clone();
    state.set_project(project).await;
    
    Ok(Json(result))
}

/// Delete a variable (archive)
pub async fn delete_variable(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<bool>, ApiError> {
    let mut project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let mut found = false;
    for var in project.variables.iter_mut() {
        if var.id == id {
            var.archived = true;
            found = true;
            break;
        }
    }
    
    if found {
        state.set_project(project).await;
    }
    
    Ok(Json(found))
}

fn parse_var_type(s: &str) -> Result<VariableType, ApiError> {
    match s.to_lowercase().as_str() {
        "string" => Ok(VariableType::String),
        "number" => Ok(VariableType::Number),
        "boolean" => Ok(VariableType::Boolean),
        "array" => Ok(VariableType::Array),
        "object" => Ok(VariableType::Object),
        other => Err(ApiError::BadRequest(format!("Unknown variable type: '{}'. Use: string, number, boolean, array, object", other))),
    }
}

fn parse_scope(scope: Option<&str>, page_id: Option<&str>) -> Result<VariableScope, ApiError> {
    match scope.unwrap_or("global") {
        "global" => Ok(VariableScope::Global),
        "page" => {
            let pid = page_id
                .ok_or_else(|| ApiError::BadRequest("page_id required for page scope".into()))?;
            Ok(VariableScope::Page { page_id: pid.to_string() })
        }
        "component" => {
            let cid = page_id
                .ok_or_else(|| ApiError::BadRequest("page_id (component_id) required for component scope".into()))?;
            Ok(VariableScope::Component { component_id: cid.to_string() })
        }
        other => Err(ApiError::BadRequest(format!("Unknown scope: '{}'. Use: global, page, component", other))),
    }
}

fn default_for_type(t: &VariableType) -> Value {
    match t {
        VariableType::String => Value::String(String::new()),
        VariableType::Number => Value::Number(serde_json::Number::from(0)),
        VariableType::Boolean => Value::Bool(false),
        VariableType::Array => Value::Array(vec![]),
        VariableType::Object => Value::Object(serde_json::Map::new()),
    }
}
