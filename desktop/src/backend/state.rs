//! App state - shared state for the API server

use std::sync::Arc;
use crate::schema::ProjectSchema;
use crate::backend::db::Database;

/// Shared application state
#[derive(Clone)]
pub struct AppState {
    /// Database connection
    pub db: Arc<Database>,
}

impl AppState {
    /// Create new app state
    pub fn new() -> Result<Self, anyhow::Error> {
        // Use 'grapes.db' in the current directory
        let db = Database::new("grapes.db")?;
        
        Ok(Self {
            db: Arc::new(db),
        })
    }
    
    /// Get all projects from DB
    pub async fn get_all_projects(&self) -> Vec<ProjectSchema> {
        self.db.get_all_projects().unwrap_or_else(|_| Vec::new())
    }

    /// Get current project from DB
    pub async fn get_project(&self) -> Option<ProjectSchema> {
        // Default to most recent for compatibility if needed, 
        // but now we prefer explicit loading
        self.db.get_all_projects()
            .ok()
            .and_then(|vals| vals.first().cloned())
    }

    /// Get project by ID
    pub async fn get_project_by_id(&self, id: &str) -> Option<ProjectSchema> {
        self.db.get_project_by_id(id).unwrap_or(None)
    }
    
    /// Set current project (save to DB)
    pub async fn set_project(&self, project: ProjectSchema) {
        if let Err(e) = self.db.save_project(&project) {
            eprintln!("Failed to save project: {}", e);
        }
    }

    /// Delete project
    pub async fn delete_project(&self, id: &str) -> bool {
        self.db.delete_project(id).is_ok()
    }

    /// Workspace path management
    pub async fn get_workspace_path(&self) -> Option<String> {
        self.db.get_workspace_path().unwrap_or(None)
    }

    pub async fn set_workspace_path(&self, path: String) {
        if let Err(e) = self.db.set_workspace_path(&path) {
            eprintln!("Failed to save workspace path: {}", e);
        }
    }
}
