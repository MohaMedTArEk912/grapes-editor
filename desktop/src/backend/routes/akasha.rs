//! Akasha routes — Product intelligence API endpoints
//!
//! Provides the HTTP API for triggering diagram analysis.

use axum::{
    extract::{Path as AxumPath, State},
    Json,
};
use std::fs;
use std::path::PathBuf;

use crate::akasha;
use crate::backend::error::ApiError;
use crate::backend::state::AppState;

/// Analyze a diagram by name.
///
/// Reads the `.drawio` file, runs the full Akasha pipeline, and returns
/// the structured product graph plus validation issues.
///
/// `POST /api/akasha/analyze/:diagram_name`
pub async fn analyze_diagram(
    State(state): State<AppState>,
    AxumPath(name): AxumPath<String>,
) -> Result<Json<akasha::AnalysisResult>, ApiError> {
    let project = state
        .get_project()
        .await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let root_path = project
        .root_path
        .as_ref()
        .ok_or_else(|| ApiError::BadRequest("Project root path not set".into()))?;

    let diagrams_dir = PathBuf::from(root_path).join("diagrams");
    let file_path = diagrams_dir.join(format!("{}.drawio", name));

    if !file_path.exists() {
        return Err(ApiError::NotFound(format!(
            "Diagram '{}' not found",
            name
        )));
    }

    let xml = fs::read_to_string(&file_path)
        .map_err(|e| ApiError::Internal(format!("Failed to read diagram: {}", e)))?;

    let result = akasha::analyze_diagram(&xml)?;

    log::info!(
        "Akasha analysis complete for '{}': {} nodes, {} edges, {} issues",
        name,
        result.stats.total_nodes,
        result.stats.total_edges,
        result.stats.issue_count
    );

    Ok(Json(result))
}

/// Analyze raw XML content directly (without reading from disk).
///
/// `POST /api/akasha/analyze-raw`
pub async fn analyze_raw(
    Json(body): Json<AnalyzeRawRequest>,
) -> Result<Json<akasha::AnalysisResult>, ApiError> {
    let result = akasha::analyze_diagram(&body.xml)?;
    Ok(Json(result))
}

#[derive(Debug, serde::Deserialize)]
pub struct AnalyzeRawRequest {
    pub xml: String,
}
