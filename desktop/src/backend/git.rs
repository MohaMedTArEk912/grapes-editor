//! Git integration — automatic versioning for Akasha projects
//!
//! Uses libgit2 (via the `git2` crate) so users don't need Git installed.

use git2::{DiffOptions, Repository, Signature, StatusOptions};
use serde::Serialize;
use std::path::Path;

/// Commit metadata returned to the frontend
#[derive(Debug, Clone, Serialize)]
pub struct CommitInfo {
    pub id: String,
    pub message: String,
    pub timestamp: i64,
    pub summary: String,
}

/// Git status summary
#[derive(Debug, Clone, Serialize)]
pub struct GitStatus {
    pub is_repo: bool,
    pub changed_files: usize,
    pub total_commits: usize,
}

// ─── Default .gitignore ─────────────────────────────────────────────────────

const DEFAULT_GITIGNORE: &str = r#"node_modules/
dist/
build/
.env
*.log
.DS_Store
Thumbs.db
"#;

// ─── Public API ─────────────────────────────────────────────────────────────

/// Initialize a Git repository at the given path.
/// Creates `.gitignore` and makes an initial commit.
/// If the repo already exists, this is a no-op.
pub fn init_repo(path: &Path) -> Result<(), String> {
    if path.join(".git").exists() {
        log::info!("Git repo already exists at {}", path.display());
        return Ok(());
    }

    log::info!("Initializing Git repo at {}", path.display());

    let repo = Repository::init(path).map_err(|e| format!("git init failed: {e}"))?;

    // Write .gitignore
    let gitignore_path = path.join(".gitignore");
    if !gitignore_path.exists() {
        std::fs::write(&gitignore_path, DEFAULT_GITIGNORE)
            .map_err(|e| format!("Failed to write .gitignore: {e}"))?;
    }

    // Stage everything and make initial commit
    stage_all(&repo)?;
    commit(&repo, "Initial commit — project created by Akasha")?;

    log::info!("Git repo initialized with initial commit");
    Ok(())
}

/// Stage all changes and commit with a message.
/// Returns `None` if there are no changes to commit.
pub fn auto_commit(path: &Path, message: &str) -> Result<Option<CommitInfo>, String> {
    let repo = open_repo(path)?;

    // Check if there are changes
    let status = get_status_count(&repo)?;
    if status == 0 {
        log::debug!("No changes to commit");
        return Ok(None);
    }

    stage_all(&repo)?;
    let oid = commit(&repo, message)?;

    let found_commit = repo
        .find_commit(oid)
        .map_err(|e| format!("Failed to find commit: {e}"))?;

    let info = commit_to_info(&found_commit);
    log::info!(
        "Auto-committed {} changed files: {} ({})",
        status,
        message,
        &info.id[..8]
    );

    Ok(Some(info))
}

/// Get commit history (most recent first).
pub fn get_history(path: &Path, limit: usize) -> Result<Vec<CommitInfo>, String> {
    let repo = open_repo(path)?;

    let mut revwalk = repo
        .revwalk()
        .map_err(|e| format!("Failed to create revwalk: {e}"))?;

    revwalk
        .push_head()
        .map_err(|e| format!("Failed to push HEAD: {e}"))?;

    let mut commits = Vec::new();

    for oid_result in revwalk {
        if commits.len() >= limit {
            break;
        }

        let oid = oid_result.map_err(|e| format!("Revwalk error: {e}"))?;
        let c = repo
            .find_commit(oid)
            .map_err(|e| format!("Failed to find commit: {e}"))?;

        commits.push(commit_to_info(&c));
    }

    Ok(commits)
}

/// Restore the working tree to a specific commit.
/// Creates a new commit "Restore to <hash>" so history is preserved.
pub fn restore_commit(path: &Path, commit_id: &str) -> Result<CommitInfo, String> {
    let repo = open_repo(path)?;

    let oid = git2::Oid::from_str(commit_id)
        .map_err(|e| format!("Invalid commit ID '{commit_id}': {e}"))?;

    let target_commit = repo
        .find_commit(oid)
        .map_err(|e| format!("Commit not found: {e}"))?;

    let tree = target_commit
        .tree()
        .map_err(|e| format!("Failed to get tree: {e}"))?;

    // Checkout that tree into the working directory
    repo.checkout_tree(
        tree.as_object(),
        Some(
            git2::build::CheckoutBuilder::new()
                .force()
                .remove_untracked(true),
        ),
    )
    .map_err(|e| format!("Checkout failed: {e}"))?;

    // Reset HEAD to current branch tip (we're not moving HEAD backwards)
    // Instead, stage the restored files and make a new commit
    stage_all(&repo)?;

    let short_id = &commit_id[..8.min(commit_id.len())];
    let restore_msg = format!("Restored to commit {short_id}");
    let new_oid = commit(&repo, &restore_msg)?;

    let new_commit = repo
        .find_commit(new_oid)
        .map_err(|e| format!("Failed to find new commit: {e}"))?;

    Ok(commit_to_info(&new_commit))
}

/// Get a text diff for a specific commit (vs its parent).
pub fn get_diff(path: &Path, commit_id: &str) -> Result<String, String> {
    let repo = open_repo(path)?;

    let oid = git2::Oid::from_str(commit_id)
        .map_err(|e| format!("Invalid commit ID: {e}"))?;

    let the_commit = repo
        .find_commit(oid)
        .map_err(|e| format!("Commit not found: {e}"))?;

    let tree = the_commit
        .tree()
        .map_err(|e| format!("Failed to get commit tree: {e}"))?;

    // Get parent tree (empty tree for initial commit)
    let parent_tree = if the_commit.parent_count() > 0 {
        the_commit
            .parent(0)
            .ok()
            .and_then(|p| p.tree().ok())
    } else {
        None
    };

    let mut opts = DiffOptions::new();
    opts.context_lines(3);

    let diff = repo
        .diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), Some(&mut opts))
        .map_err(|e| format!("Diff failed: {e}"))?;

    let mut diff_text = String::new();
    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        let origin = line.origin();
        if origin == '+' || origin == '-' || origin == ' ' {
            diff_text.push(origin);
        }
        if let Ok(content) = std::str::from_utf8(line.content()) {
            diff_text.push_str(content);
        }
        true
    })
    .map_err(|e| format!("Diff print failed: {e}"))?;

    Ok(diff_text)
}

/// Get the current Git status for a project path.
pub fn get_git_status(path: &Path) -> Result<GitStatus, String> {
    if !path.join(".git").exists() {
        return Ok(GitStatus {
            is_repo: false,
            changed_files: 0,
            total_commits: 0,
        });
    }

    let repo = open_repo(path)?;
    let changed = get_status_count(&repo)?;

    // Count total commits
    let total_commits = match repo.revwalk() {
        Ok(mut rw) => {
            if rw.push_head().is_ok() {
                rw.count()
            } else {
                0
            }
        }
        Err(_) => 0,
    };

    Ok(GitStatus {
        is_repo: true,
        changed_files: changed,
        total_commits,
    })
}

/// Create a manual commit with a user-provided message.
pub fn manual_commit(path: &Path, message: &str) -> Result<Option<CommitInfo>, String> {
    auto_commit(path, message)
}

// ─── Internal helpers ───────────────────────────────────────────────────────

fn open_repo(path: &Path) -> Result<Repository, String> {
    Repository::open(path).map_err(|e| format!("Failed to open Git repo at {}: {e}", path.display()))
}

fn stage_all(repo: &Repository) -> Result<(), String> {
    let mut index = repo
        .index()
        .map_err(|e| format!("Failed to get index: {e}"))?;

    index
        .add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
        .map_err(|e| format!("Failed to stage files: {e}"))?;

    // Also remove deleted files from the index
    let mut opts = StatusOptions::new();
    opts.include_untracked(false);

    index
        .write()
        .map_err(|e| format!("Failed to write index: {e}"))?;

    Ok(())
}

fn commit(repo: &Repository, message: &str) -> Result<git2::Oid, String> {
    let sig = Signature::now("Akasha", "akasha@local")
        .map_err(|e| format!("Failed to create signature: {e}"))?;

    let mut index = repo
        .index()
        .map_err(|e| format!("Failed to get index: {e}"))?;

    let tree_oid = index
        .write_tree()
        .map_err(|e| format!("Failed to write tree: {e}"))?;

    let tree = repo
        .find_tree(tree_oid)
        .map_err(|e| format!("Failed to find tree: {e}"))?;

    // Get parent commit (if any)
    let parent = repo.head().ok().and_then(|h| h.peel_to_commit().ok());

    let parents: Vec<&git2::Commit> = parent.as_ref().into_iter().collect();

    repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &parents)
        .map_err(|e| format!("Commit failed: {e}"))
}

fn get_status_count(repo: &Repository) -> Result<usize, String> {
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true);

    let statuses = repo
        .statuses(Some(&mut opts))
        .map_err(|e| format!("Failed to get status: {e}"))?;

    Ok(statuses.len())
}

fn commit_to_info(commit: &git2::Commit) -> CommitInfo {
    CommitInfo {
        id: commit.id().to_string(),
        message: commit.message().unwrap_or("").to_string(),
        timestamp: commit.time().seconds(),
        summary: commit.summary().unwrap_or("").to_string(),
    }
}
