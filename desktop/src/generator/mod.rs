//! Code Generator module
//!
//! Generates production-ready code from the project schema:
//! - Frontend: React + Tailwind
//! - Backend: NestJS + Prisma
//! - Database: SQL migrations

pub mod backend;
pub mod database;
pub mod flow_wiring;
pub mod frontend;
pub mod logic_compiler;
pub mod openapi;
pub mod sync_engine;

// Re-exports
pub use backend::BackendGenerator;
pub use database::DatabaseGenerator;
pub use flow_wiring::{FlowWiring, FlowWiringResolver};
pub use frontend::FrontendGenerator;
pub use logic_compiler::LogicCompiler;
pub use openapi::OpenApiGenerator;
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
