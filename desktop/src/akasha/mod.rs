//! Akasha Product Intelligence Module
//!
//! Transforms Draw.io diagrams into structured, validated product graphs.
//! Pipeline: Raw XML → Parse → Build Graph → Analyze Types → Validate → Output

pub mod parser;
pub mod graph;
pub mod analyzer;
pub mod validator;

use crate::backend::error::ApiError;
pub use graph::{ProductGraph, ProductNode, ProductEdge, NodeType};
pub use validator::{ValidationIssue, Severity};

/// Full analysis result returned to the frontend / AI layer.
#[derive(Debug, serde::Serialize)]
pub struct AnalysisResult {
    /// The structured product graph (nodes + edges with inferred types).
    pub graph: ProductGraph,
    /// Validation issues found during structural analysis.
    pub issues: Vec<ValidationIssue>,
    /// Summary statistics.
    pub stats: GraphStats,
}

#[derive(Debug, serde::Serialize)]
pub struct GraphStats {
    pub total_nodes: usize,
    pub total_edges: usize,
    pub unknown_type_count: usize,
    pub issue_count: usize,
}

/// Run the full Akasha pipeline on raw Draw.io XML.
pub fn analyze_diagram(xml: &str) -> Result<AnalysisResult, ApiError> {
    // 1. Parse raw XML into intermediate mxCell list
    let cells = parser::parse_drawio_xml(xml)?;

    // 2. Build the product graph (separate nodes & edges)
    let mut product_graph = graph::build_graph(&cells);

    // 3. Analyze: infer semantic types on each node
    analyzer::infer_types(&mut product_graph);

    // 4. Validate the graph
    let issues = validator::validate(&product_graph);

    let stats = GraphStats {
        total_nodes: product_graph.nodes.len(),
        total_edges: product_graph.edges.len(),
        unknown_type_count: product_graph
            .nodes
            .iter()
            .filter(|n| n.node_type == NodeType::Unknown)
            .count(),
        issue_count: issues.len(),
    };

    Ok(AnalysisResult {
        graph: product_graph,
        issues,
        stats,
    })
}
