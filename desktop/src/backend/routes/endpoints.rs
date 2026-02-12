//! API endpoint routes

use axum::{
    extract::{Path, State},
    Json,
};
use serde::Deserialize;

use crate::backend::error::ApiError;
use crate::backend::state::AppState;
use crate::schema::api::DataShape;
use crate::schema::{ApiSchema, HttpMethod};

/// Add endpoint request
#[derive(Debug, Deserialize)]
pub struct AddEndpointRequest {
    pub method: String,
    pub path: String,
    pub name: String,
}

/// Update endpoint request
#[derive(Debug, Deserialize)]
pub struct UpdateEndpointRequest {
    pub method: Option<String>,
    pub path: Option<String>,
    pub name: Option<String>,
    pub description: Option<String>,
    pub auth_required: Option<bool>,
    pub request_body: Option<Option<DataShape>>,
    pub response_body: Option<Option<DataShape>>,
    pub permissions: Option<Vec<String>>,
    pub logic_flow_id: Option<Option<String>>,
}

/// Add a new API endpoint
pub async fn add_endpoint(
    State(state): State<AppState>,
    Json(req): Json<AddEndpointRequest>,
) -> Result<Json<ApiSchema>, ApiError> {
    let mut project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let method = parse_http_method(&req.method)?;

    let api = ApiSchema::new(
        uuid::Uuid::new_v4().to_string(),
        method,
        &req.path,
        &req.name,
    );

    let result = api.clone();
    project.add_api(api);
    state.set_project(project).await;

    Ok(Json(result))
}

/// Get all API endpoints
pub async fn get_endpoints(
    State(state): State<AppState>,
) -> Result<Json<Vec<ApiSchema>>, ApiError> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let endpoints: Vec<ApiSchema> = project
        .apis
        .iter()
        .filter(|a| !a.archived)
        .cloned()
        .collect();

    Ok(Json(endpoints))
}

/// Update an API endpoint
pub async fn update_endpoint(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<UpdateEndpointRequest>,
) -> Result<Json<ApiSchema>, ApiError> {
    let mut project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let api = project
        .apis
        .iter_mut()
        .find(|a| a.id == id && !a.archived)
        .ok_or_else(|| ApiError::NotFound(format!("Endpoint '{}' not found", id)))?;

    if let Some(method_str) = &req.method {
        api.method = parse_http_method(method_str)?;
    }
    if let Some(path) = req.path {
        api.path = path;
    }
    if let Some(name) = req.name {
        api.name = name;
    }
    if let Some(description) = req.description {
        api.description = Some(description);
    }
    if let Some(auth_required) = req.auth_required {
        if auth_required && api.permissions.is_empty() {
            api.permissions.push("authenticated".into());
        } else if !auth_required {
            api.permissions.clear();
        }
    }
    if let Some(request_body) = req.request_body {
        api.request_body = request_body;
    }
    if let Some(response_body) = req.response_body {
        api.response_body = response_body;
    }
    if let Some(permissions) = req.permissions {
        api.permissions = permissions;
    }
    if let Some(logic_flow_id) = req.logic_flow_id {
        api.logic_flow_id = logic_flow_id
            .map(|id| id.trim().to_string())
            .filter(|id| !id.is_empty());
    }

    let result = api.clone();
    state.set_project(project).await;

    Ok(Json(result))
}

/// Delete an API endpoint (archive)
pub async fn delete_endpoint(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<bool>, ApiError> {
    let mut project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let mut found = false;
    for api in project.apis.iter_mut() {
        if api.id == id {
            api.archived = true;
            found = true;
            break;
        }
    }

    if found {
        state.set_project(project).await;
    }

    Ok(Json(found))
}

/// Parse HTTP method string to enum
fn parse_http_method(method: &str) -> Result<HttpMethod, ApiError> {
    match method.to_uppercase().as_str() {
        "GET" => Ok(HttpMethod::Get),
        "POST" => Ok(HttpMethod::Post),
        "PUT" => Ok(HttpMethod::Put),
        "PATCH" => Ok(HttpMethod::Patch),
        "DELETE" => Ok(HttpMethod::Delete),
        _ => Err(ApiError::BadRequest(format!(
            "Invalid HTTP method: {}",
            method
        ))),
    }
}
