//! Code Generator module
//! 
//! Generates production-ready code from the project schema:
//! - Frontend: React + Tailwind
//! - Backend: NestJS + Prisma
//! - Database: SQL migrations

pub mod frontend;
pub mod backend;
pub mod database;
pub mod sync_engine;

// Re-exports
pub use frontend::FrontendGenerator;
pub use backend::BackendGenerator;
pub use database::DatabaseGenerator;
pub use sync_engine::SyncEngine;

/// Convert string to PascalCase (Shared utility)
pub fn pascal_case(s: &str) -> String {
    s.split(|c: char| !c.is_alphanumeric())
        .filter(|w| !w.is_empty())
        .map(|w| {
            let mut chars = w.chars();
            match chars.next() {
                None => String::new(),
                Some(c) => c.to_uppercase().chain(chars).collect(),
            }
        })
        .collect()
}
