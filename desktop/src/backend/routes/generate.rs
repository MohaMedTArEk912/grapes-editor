//! Code generation routes

use axum::{
    extract::State,
    Json,
};
use serde::Serialize;

use crate::backend::state::AppState;
use crate::backend::error::ApiError;

/// Generated code response
#[derive(Debug, Serialize)]
pub struct GeneratedCode {
    pub files: Vec<GeneratedFile>,
}

#[derive(Debug, Serialize)]
pub struct GeneratedFile {
    pub path: String,
    pub content: String,
}

/// Generate frontend code (React + Auth + Hooks + Layout)
pub async fn generate_frontend(
    State(state): State<AppState>,
) -> Result<Json<GeneratedCode>, ApiError> {
    let project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let generator = crate::generator::FrontendGenerator::new(&project);
    let output = generator.generate();
    
    Ok(Json(GeneratedCode {
        files: output.files.into_iter().map(|f| GeneratedFile {
            path: f.path,
            content: f.content,
        }).collect(),
    }))
}

/// Generate backend code (NestJS + Prisma Services + Auth + DTOs + Deployment)
pub async fn generate_backend(
    State(state): State<AppState>,
) -> Result<Json<GeneratedCode>, ApiError> {
    let project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let generator = crate::generator::BackendGenerator::new(&project);
    let output = generator.generate();

    // Also compile logic flows and append them
    let compiled = crate::generator::LogicCompiler::compile_all(&project.logic_flows);

    let mut files: Vec<GeneratedFile> = output.files.into_iter().map(|f| GeneratedFile {
        path: f.path,
        content: f.content,
    }).collect();

    for cf in compiled {
        files.push(GeneratedFile {
            path: cf.path,
            content: cf.code,
        });
    }
    
    Ok(Json(GeneratedCode { files }))
}

/// Generate database schema (Prisma)
pub async fn generate_database(
    State(state): State<AppState>,
) -> Result<Json<GeneratedCode>, ApiError> {
    let project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let generator = crate::generator::DatabaseGenerator::new(&project);
    let output = generator.generate();
    
    Ok(Json(GeneratedCode {
        files: output.files.into_iter().map(|f| GeneratedFile {
            path: f.path,
            content: f.content,
        }).collect(),
    }))
}

/// Generate ZIP archive of the entire project
pub async fn generate_zip(
    State(state): State<AppState>,
) -> Result<impl axum::response::IntoResponse, ApiError> {
    let project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let mut buf = Vec::new();
    let mut zip = zip::ZipWriter::new(std::io::Cursor::new(&mut buf));
    let options = zip::write::FileOptions::default()
        .compression_method(zip::CompressionMethod::Stored)
        .unix_permissions(0o755);

    // --- FRONTEND ---
    let fe_generator = crate::generator::FrontendGenerator::new(&project);
    let fe_output = fe_generator.generate();
    for file in fe_output.files {
        zip.start_file(format!("client/{}", file.path), options)
            .map_err(|e| ApiError::Internal(e.to_string()))?;
        use std::io::Write;
        zip.write_all(file.content.as_bytes()).map_err(|e| ApiError::Internal(e.to_string()))?;
    }

    // --- BACKEND ---
    let be_generator = crate::generator::BackendGenerator::new(&project);
    let be_output = be_generator.generate();
    for file in be_output.files {
        zip.start_file(format!("server/{}", file.path), options)
            .map_err(|e| ApiError::Internal(e.to_string()))?;
        use std::io::Write;
        zip.write_all(file.content.as_bytes()).map_err(|e| ApiError::Internal(e.to_string()))?;
    }

    // --- DATABASE (placed inside server/) ---
    let db_generator = crate::generator::DatabaseGenerator::new(&project);
    let db_output = db_generator.generate();
    for file in db_output.files {
        zip.start_file(format!("server/{}", file.path), options)
            .map_err(|e| ApiError::Internal(e.to_string()))?;
        use std::io::Write;
        zip.write_all(file.content.as_bytes()).map_err(|e| ApiError::Internal(e.to_string()))?;
    }

    // --- LOGIC FLOWS ---
    let compiled_flows = crate::generator::LogicCompiler::compile_all(&project.logic_flows);
    for cf in &compiled_flows {
        let prefix = match cf.context {
            crate::schema::logic_flow::FlowContext::Backend => "server",
            crate::schema::logic_flow::FlowContext::Frontend => "client",
        };
        zip.start_file(format!("{}/{}", prefix, cf.path), options)
            .map_err(|e| ApiError::Internal(e.to_string()))?;
        use std::io::Write;
        zip.write_all(cf.code.as_bytes()).map_err(|e| ApiError::Internal(e.to_string()))?;
    }

    // --- CONFIG ---
    zip.start_file("akasha.config.json", options)
        .map_err(|e| ApiError::Internal(e.to_string()))?;
    use std::io::Write;
    let config_json = serde_json::to_string_pretty(&project).unwrap();
    zip.write_all(config_json.as_bytes()).map_err(|e| ApiError::Internal(e.to_string()))?;

    // --- OPENAPI SPEC ---
    let openapi_spec = crate::generator::OpenApiGenerator::generate(&project);
    let openapi_json = serde_json::to_string_pretty(&openapi_spec).unwrap();
    zip.start_file("server/docs/openapi.json", options)
        .map_err(|e| ApiError::Internal(e.to_string()))?;
    zip.write_all(openapi_json.as_bytes()).map_err(|e| ApiError::Internal(e.to_string()))?;

    // --- Root README ---
    let readme = format!("# {}\n\nGenerated by Akasha.\n\n## Structure\n\n- `client/` — React + Tailwind frontend\n- `server/` — NestJS + Prisma backend\n\n## Quick Start\n\n```bash\n# Backend\ncd server\nnpm install\nnpx prisma migrate dev --name init\nnpm run start:dev\n\n# Frontend (another terminal)\ncd client\nnpm install\nnpm run dev\n```\n", project.name);
    zip.start_file("README.md", options)
        .map_err(|e| ApiError::Internal(e.to_string()))?;
    zip.write_all(readme.as_bytes()).map_err(|e| ApiError::Internal(e.to_string()))?;

    zip.finish().map_err(|e| ApiError::Internal(e.to_string()))?;
    drop(zip);

    Ok((
        axum::http::StatusCode::OK,
        [
            (axum::http::header::CONTENT_TYPE, "application/zip"),
            (axum::http::header::CONTENT_DISPOSITION, "attachment; filename=\"project.zip\""),
        ],
        buf,
    ))
}

/// Generate OpenAPI 3.0 specification
pub async fn generate_openapi(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

    let spec = crate::generator::OpenApiGenerator::generate(&project);
    Ok(Json(spec))
}
