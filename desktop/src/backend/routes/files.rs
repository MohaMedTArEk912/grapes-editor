//! File system routes - CRUD operations for project files
//!
//! Provides endpoints for listing, creating, renaming, and deleting files/folders
//! in the project's root directory.

use axum::{
    extract::{State, Query},
    Json,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

use crate::backend::state::AppState;
use crate::backend::error::ApiError;

/// File/folder entry in directory listing
#[derive(Debug, Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size: Option<u64>,
    pub extension: Option<String>,
}

/// Directory listing response
#[derive(Debug, Serialize)]
pub struct DirectoryListing {
    pub path: String,
    pub entries: Vec<FileEntry>,
}

/// Query params for listing directory
#[derive(Debug, Deserialize)]
pub struct ListDirQuery {
    pub path: Option<String>,
}

/// Create file request
#[derive(Debug, Deserialize)]
pub struct CreateFileRequest {
    pub path: String,
    pub content: Option<String>,
}

/// Create folder request
#[derive(Debug, Deserialize)]
pub struct CreateFolderRequest {
    pub path: String,
}

/// Rename request
#[derive(Debug, Deserialize)]
pub struct RenameRequest {
    pub old_path: String,
    pub new_path: String,
}

/// Delete request
#[derive(Debug, Deserialize)]
pub struct DeleteRequest {
    pub path: String,
}

/// Read file request
#[derive(Debug, Deserialize)]
pub struct ReadFileQuery {
    pub path: String,
}

/// Read file response
#[derive(Debug, Serialize)]
pub struct FileContentResponse {
    pub content: String,
    pub path: String,
}

/// List directory contents
pub async fn list_directory(
    State(state): State<AppState>,
    Query(query): Query<ListDirQuery>,
) -> Result<Json<DirectoryListing>, ApiError> {
    let project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let root_path = project.root_path.as_ref()
        .ok_or_else(|| ApiError::BadRequest("Project root path not set".into()))?;
    
    // Determine the directory to list
    let target_path = match &query.path {
        Some(p) if !p.is_empty() => PathBuf::from(root_path).join(p),
        _ => PathBuf::from(root_path),
    };
    
    if !target_path.exists() {
        return Err(ApiError::NotFound(format!("Directory not found: {:?}", target_path)));
    }
    
    if !target_path.is_dir() {
        return Err(ApiError::BadRequest("Path is not a directory".into()));
    }
    
    let mut entries: Vec<FileEntry> = Vec::new();
    
    let read_dir = fs::read_dir(&target_path)
        .map_err(|e| ApiError::Internal(format!("Failed to read directory: {}", e)))?;
    
    for entry in read_dir {
        let entry = entry.map_err(|e| ApiError::Internal(format!("Failed to read entry: {}", e)))?;
        let metadata = entry.metadata()
            .map_err(|e| ApiError::Internal(format!("Failed to read metadata: {}", e)))?;
        
        let name = entry.file_name().to_string_lossy().to_string();
        let full_path = entry.path();
        
        // Get relative path from root
        let relative_path = full_path.strip_prefix(root_path)
            .unwrap_or(&full_path)
            .to_string_lossy()
            .to_string()
            .replace("\\", "/");
        
        let extension = if metadata.is_file() {
            Path::new(&name).extension().map(|e| e.to_string_lossy().to_string())
        } else {
            None
        };
        
        entries.push(FileEntry {
            name,
            path: relative_path,
            is_directory: metadata.is_dir(),
            size: if metadata.is_file() { Some(metadata.len()) } else { None },
            extension,
        });
    }
    
    // Sort: directories first, then by name
    entries.sort_by(|a, b| {
        match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });
    
    let relative_dir = target_path.strip_prefix(root_path)
        .unwrap_or(&target_path)
        .to_string_lossy()
        .to_string()
        .replace("\\", "/");
    
    Ok(Json(DirectoryListing {
        path: relative_dir,
        entries,
    }))
}

/// Create a new file
pub async fn create_file(
    State(state): State<AppState>,
    Json(req): Json<CreateFileRequest>,
) -> Result<Json<FileEntry>, ApiError> {
    let project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let root_path = project.root_path.as_ref()
        .ok_or_else(|| ApiError::BadRequest("Project root path not set".into()))?;
    
    let file_path = PathBuf::from(root_path).join(&req.path);
    
    if file_path.exists() {
        return Err(ApiError::BadRequest("File already exists".into()));
    }
    
    // Create parent directories if needed
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| ApiError::Internal(format!("Failed to create parent directories: {}", e)))?;
    }
    
    // Write content (empty if not provided)
    let content = req.content.unwrap_or_default();
    fs::write(&file_path, &content)
        .map_err(|e| ApiError::Internal(format!("Failed to create file: {}", e)))?;
    
    let name = file_path.file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    
    let extension = Path::new(&name).extension().map(|e| e.to_string_lossy().to_string());
    
    Ok(Json(FileEntry {
        name,
        path: req.path,
        is_directory: false,
        size: Some(content.len() as u64),
        extension,
    }))
}

/// Create a new folder
pub async fn create_folder(
    State(state): State<AppState>,
    Json(req): Json<CreateFolderRequest>,
) -> Result<Json<FileEntry>, ApiError> {
    let project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let root_path = project.root_path.as_ref()
        .ok_or_else(|| ApiError::BadRequest("Project root path not set".into()))?;
    
    let folder_path = PathBuf::from(root_path).join(&req.path);
    
    if folder_path.exists() {
        return Err(ApiError::BadRequest("Folder already exists".into()));
    }
    
    fs::create_dir_all(&folder_path)
        .map_err(|e| ApiError::Internal(format!("Failed to create folder: {}", e)))?;
    
    let name = folder_path.file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    
    Ok(Json(FileEntry {
        name,
        path: req.path,
        is_directory: true,
        size: None,
        extension: None,
    }))
}

/// Rename a file or folder
pub async fn rename_file(
    State(state): State<AppState>,
    Json(req): Json<RenameRequest>,
) -> Result<Json<FileEntry>, ApiError> {
    let project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let root_path = project.root_path.as_ref()
        .ok_or_else(|| ApiError::BadRequest("Project root path not set".into()))?;
    
    let old_path = PathBuf::from(root_path).join(&req.old_path);
    let new_path = PathBuf::from(root_path).join(&req.new_path);
    
    if !old_path.exists() {
        return Err(ApiError::NotFound("Source file/folder not found".into()));
    }
    
    if new_path.exists() {
        return Err(ApiError::BadRequest("Destination already exists".into()));
    }
    
    fs::rename(&old_path, &new_path)
        .map_err(|e| ApiError::Internal(format!("Failed to rename: {}", e)))?;
    
    let metadata = fs::metadata(&new_path)
        .map_err(|e| ApiError::Internal(format!("Failed to read metadata: {}", e)))?;
    
    let name = new_path.file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    
    let extension = if metadata.is_file() {
        Path::new(&name).extension().map(|e| e.to_string_lossy().to_string())
    } else {
        None
    };
    
    Ok(Json(FileEntry {
        name,
        path: req.new_path,
        is_directory: metadata.is_dir(),
        size: if metadata.is_file() { Some(metadata.len()) } else { None },
        extension,
    }))
}

/// Delete a file or folder
pub async fn delete_file(
    State(state): State<AppState>,
    Json(req): Json<DeleteRequest>,
) -> Result<Json<bool>, ApiError> {
    let project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let root_path = project.root_path.as_ref()
        .ok_or_else(|| ApiError::BadRequest("Project root path not set".into()))?;
    
    let target_path = PathBuf::from(root_path).join(&req.path);
    
    if !target_path.exists() {
        return Err(ApiError::NotFound("File/folder not found".into()));
    }
    
    // Prevent deleting the root
    if target_path == PathBuf::from(root_path) {
        return Err(ApiError::BadRequest("Cannot delete project root".into()));
    }
    
    if target_path.is_dir() {
        fs::remove_dir_all(&target_path)
            .map_err(|e| ApiError::Internal(format!("Failed to delete folder: {}", e)))?;
    } else {
        fs::remove_file(&target_path)
            .map_err(|e| ApiError::Internal(format!("Failed to delete file: {}", e)))?;
    }
    
    Ok(Json(true))
}

/// Read file content
pub async fn read_file(
    State(state): State<AppState>,
    Query(query): Query<ReadFileQuery>,
) -> Result<Json<FileContentResponse>, ApiError> {
    let project = state.get_project().await
        .ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;
    
    let root_path = project.root_path.as_ref()
        .ok_or_else(|| ApiError::BadRequest("Project root path not set".into()))?;
    
    let file_path = PathBuf::from(root_path).join(&query.path);
    
    if !file_path.exists() {
        return Err(ApiError::NotFound("File not found".into()));
    }
    
    if file_path.is_dir() {
        return Err(ApiError::BadRequest("Path is a directory, not a file".into()));
    }
    
    let content = fs::read_to_string(&file_path)
        .map_err(|e| ApiError::Internal(format!("Failed to read file: {}", e)))?;
    
    Ok(Json(FileContentResponse {
        content,
        path: query.path,
    }))
}
