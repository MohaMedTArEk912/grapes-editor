//! Akasha Backend — Embedded API Server
//!
//! This module provides the REST API server functionality that can be embedded
//! in the Tauri desktop app. It provides:
//! - Project management API
//! - Schema operations (blocks, pages, APIs, models)
//! - Code generation endpoints
//! - SQLite persistence

pub mod db;
pub mod error;
pub mod routes;
pub mod state;

// Schema is now at the root level

pub mod watcher;

pub use error::ApiError;
pub use state::AppState as BackendAppState;

use axum::{
    routing::{delete, get, patch, post, put},
    Router,
};
use tower_http::cors::{Any, CorsLayer};

/// Create the backend router with all API endpoints
pub fn create_router(state: BackendAppState) -> Router {
    Router::new()
        // Health check
        .route("/health", get(|| async { "OK" }))
        // Workspace routes
        .route("/api/workspace", get(routes::workspace::get_workspace))
        .route("/api/workspace", post(routes::workspace::set_workspace))
        .route(
            "/api/workspace/pick-folder",
            get(routes::workspace::pick_folder),
        )
        .route(
            "/api/workspace/projects/:id",
            get(routes::workspace::load_project),
        )
        .route(
            "/api/workspace/projects/:id",
            delete(routes::workspace::delete_project),
        )
        // Project routes
        .route("/api/project", get(routes::project::get_project))
        .route("/api/project", post(routes::project::create_project))
        .route("/api/project", patch(routes::project::rename_project))
        .route("/api/project/import", post(routes::project::import_project))
        .route("/api/project/export", get(routes::project::export_project))
        .route("/api/project/reset", post(routes::project::reset_project))
        .route(
            "/api/project/install",
            post(routes::project::install_project_dependencies),
        )
        .route(
            "/api/project/sync/root",
            post(routes::project::set_sync_root),
        )
        .route("/api/project/sync/now", post(routes::project::trigger_sync))
        .route(
            "/api/project/sync/from_disk",
            post(routes::project::sync_disk_to_memory),
        )
        .route(
            "/api/project/settings",
            put(routes::project::update_settings),
        )
        // Block routes
        .route("/api/blocks", post(routes::blocks::add_block))
        .route("/api/blocks/:id", put(routes::blocks::update_block))
        .route("/api/blocks/:id", delete(routes::blocks::delete_block))
        .route("/api/blocks/:id/move", put(routes::blocks::move_block))
        // Component routes
        .route("/api/components", get(routes::components::list_components))
        .route(
            "/api/components",
            post(routes::components::create_component),
        )
        .route(
            "/api/components/:id",
            get(routes::components::get_component),
        )
        // Page routes
        .route("/api/pages", post(routes::pages::add_page))
        .route("/api/pages/:id", put(routes::pages::update_page))
        .route("/api/pages/:id", delete(routes::pages::delete_page))
        .route(
            "/api/pages/:id/content",
            get(routes::pages::get_page_content),
        )
        // Logic routes
        .route("/api/logic", get(routes::logic::get_logic_flows))
        .route("/api/logic", post(routes::logic::create_logic_flow))
        .route("/api/logic/:id", put(routes::logic::update_logic_flow))
        .route("/api/logic/:id", delete(routes::logic::delete_logic_flow))
        // Data model routes
        .route("/api/models", get(routes::models::get_models))
        .route("/api/models", post(routes::models::add_model))
        .route("/api/models/:id", put(routes::models::update_model))
        .route("/api/models/:id", delete(routes::models::delete_model))
        .route("/api/models/:id/fields", post(routes::models::add_field))
        .route(
            "/api/models/:id/fields/:field_id",
            put(routes::models::update_field),
        )
        .route(
            "/api/models/:id/fields/:field_id",
            delete(routes::models::delete_field),
        )
        .route(
            "/api/models/:id/relations",
            post(routes::models::add_relation),
        )
        .route(
            "/api/models/:id/relations/:relation_id",
            delete(routes::models::delete_relation),
        )
        // API endpoint routes
        .route("/api/endpoints", get(routes::endpoints::get_endpoints))
        .route("/api/endpoints", post(routes::endpoints::add_endpoint))
        .route(
            "/api/endpoints/:id",
            put(routes::endpoints::update_endpoint),
        )
        .route(
            "/api/endpoints/:id",
            delete(routes::endpoints::delete_endpoint),
        )
        // Variable routes
        .route("/api/variables", get(routes::variables::get_variables))
        .route("/api/variables", post(routes::variables::create_variable))
        .route(
            "/api/variables/:id",
            put(routes::variables::update_variable),
        )
        .route(
            "/api/variables/:id",
            delete(routes::variables::delete_variable),
        )
        // Code generation
        .route(
            "/api/generate/frontend",
            post(routes::generate::generate_frontend),
        )
        .route(
            "/api/generate/backend",
            post(routes::generate::generate_backend),
        )
        .route(
            "/api/generate/database",
            post(routes::generate::generate_database),
        )
        .route("/api/generate/zip", get(routes::generate::generate_zip))
        .route(
            "/api/generate/openapi",
            get(routes::generate::generate_openapi),
        )
        // File system routes
        .route("/api/files", get(routes::files::list_directory))
        .route("/api/files", post(routes::files::create_file))
        .route("/api/files/folder", post(routes::files::create_folder))
        .route("/api/files/rename", put(routes::files::rename_file))
        .route("/api/files/delete", delete(routes::files::delete_file))
        .route("/api/files/content", get(routes::files::read_file))
        .route("/api/files/content", put(routes::files::write_file))
        // CORS layer
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(state)
}
