//! Graph Validator — Structural integrity checks
//!
//! Validates the product graph for:
//! - Orphan nodes (no connections)
//! - Dangling edges (source/target doesn't exist)
//! - Invalid relationship patterns
//! - Missing architectural links
//! - Untyped nodes that need review

use serde::Serialize;
use std::collections::HashSet;

use super::graph::{NodeType, ProductGraph};

/// Severity of a validation issue.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    /// Informational — won't break anything but worth noting.
    Info,
    /// Warning — potential problem that should be reviewed.
    Warning,
    /// Error — structural issue that must be fixed.
    Error,
}

/// A single validation issue.
#[derive(Debug, Clone, Serialize)]
pub struct ValidationIssue {
    pub severity: Severity,
    pub message: String,
    /// The element ID this issue relates to (node or edge).
    pub element_id: Option<String>,
    /// A machine-readable rule code for programmatic handling.
    pub rule: String,
}

/// Validate the product graph and return a list of issues.
pub fn validate(graph: &ProductGraph) -> Vec<ValidationIssue> {
    let mut issues = Vec::new();

    check_orphan_nodes(graph, &mut issues);
    check_dangling_edges(graph, &mut issues);
    check_unknown_types(graph, &mut issues);
    check_architectural_patterns(graph, &mut issues);

    issues
}

/// Nodes that have zero edges connected to them.
fn check_orphan_nodes(graph: &ProductGraph, issues: &mut Vec<ValidationIssue>) {
    let connected: HashSet<&str> = graph
        .edges
        .iter()
        .flat_map(|e| [e.source.as_str(), e.target.as_str()])
        .collect();

    for node in &graph.nodes {
        if !connected.contains(node.id.as_str()) {
            issues.push(ValidationIssue {
                severity: Severity::Warning,
                message: format!(
                    "Node '{}' ({}) is an orphan — not connected to any other element.",
                    node.label,
                    node.id
                ),
                element_id: Some(node.id.clone()),
                rule: "orphan_node".to_string(),
            });
        }
    }
}

/// Edges that reference a source or target that doesn't exist in the graph.
fn check_dangling_edges(graph: &ProductGraph, issues: &mut Vec<ValidationIssue>) {
    let node_ids: HashSet<&str> = graph.nodes.iter().map(|n| n.id.as_str()).collect();

    for edge in &graph.edges {
        if !edge.source.is_empty() && !node_ids.contains(edge.source.as_str()) {
            issues.push(ValidationIssue {
                severity: Severity::Error,
                message: format!(
                    "Edge '{}' references non-existent source node '{}'.",
                    edge.id, edge.source
                ),
                element_id: Some(edge.id.clone()),
                rule: "dangling_edge_source".to_string(),
            });
        }
        if !edge.target.is_empty() && !node_ids.contains(edge.target.as_str()) {
            issues.push(ValidationIssue {
                severity: Severity::Error,
                message: format!(
                    "Edge '{}' references non-existent target node '{}'.",
                    edge.id, edge.target
                ),
                element_id: Some(edge.id.clone()),
                rule: "dangling_edge_target".to_string(),
            });
        }
        if edge.source.is_empty() || edge.target.is_empty() {
            issues.push(ValidationIssue {
                severity: Severity::Error,
                message: format!(
                    "Edge '{}' is missing a {} endpoint.",
                    edge.id,
                    if edge.source.is_empty() {
                        "source"
                    } else {
                        "target"
                    }
                ),
                element_id: Some(edge.id.clone()),
                rule: "incomplete_edge".to_string(),
            });
        }
    }
}

/// Nodes whose type could not be inferred.
fn check_unknown_types(graph: &ProductGraph, issues: &mut Vec<ValidationIssue>) {
    for node in &graph.nodes {
        if node.node_type == NodeType::Unknown {
            issues.push(ValidationIssue {
                severity: Severity::Info,
                message: format!(
                    "Node '{}' ({}) has an unrecognized type — please review and classify.",
                    node.label, node.id
                ),
                element_id: Some(node.id.clone()),
                rule: "unknown_type".to_string(),
            });
        }
    }
}

/// Check for common architectural anti-patterns.
fn check_architectural_patterns(graph: &ProductGraph, issues: &mut Vec<ValidationIssue>) {
    let has_actor = graph.nodes.iter().any(|n| n.node_type == NodeType::Actor);
    let has_screen = graph.nodes.iter().any(|n| n.node_type == NodeType::Screen);
    let has_api = graph.nodes.iter().any(|n| n.node_type == NodeType::Api);
    let has_db = graph.nodes.iter().any(|n| n.node_type == NodeType::Database);

    // Architectural completeness hints
    if has_screen && !has_api {
        issues.push(ValidationIssue {
            severity: Severity::Info,
            message: "Diagram has Screen nodes but no API nodes. Consider adding an API layer."
                .to_string(),
            element_id: None,
            rule: "missing_api_layer".to_string(),
        });
    }

    if has_api && !has_db {
        issues.push(ValidationIssue {
            severity: Severity::Info,
            message:
                "Diagram has API nodes but no Database nodes. Consider adding a data persistence layer."
                    .to_string(),
            element_id: None,
            rule: "missing_database_layer".to_string(),
        });
    }

    if !has_actor && graph.nodes.len() > 2 {
        issues.push(ValidationIssue {
            severity: Severity::Info,
            message:
                "No Actor/User node found. Consider adding actors to show who interacts with the system."
                    .to_string(),
            element_id: None,
            rule: "missing_actor".to_string(),
        });
    }

    // Check for direct Actor → Database connections (skipping API layer)
    for edge in &graph.edges {
        let source_type = graph.nodes.iter().find(|n| n.id == edge.source).map(|n| &n.node_type);
        let target_type = graph.nodes.iter().find(|n| n.id == edge.target).map(|n| &n.node_type);

        if matches!(source_type, Some(NodeType::Actor))
            && matches!(target_type, Some(NodeType::Database))
        {
            issues.push(ValidationIssue {
                severity: Severity::Warning,
                message: format!(
                    "Direct Actor → Database connection detected (edge '{}'). Consider adding an intermediary API or service layer.",
                    edge.id
                ),
                element_id: Some(edge.id.clone()),
                rule: "actor_direct_db".to_string(),
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::akasha::graph::{ProductEdge, ProductNode, RelationshipType};

    fn make_node(id: &str, label: &str, node_type: NodeType) -> ProductNode {
        ProductNode {
            id: id.to_string(),
            label: label.to_string(),
            node_type,
            properties: Default::default(),
        }
    }

    fn make_edge(id: &str, source: &str, target: &str) -> ProductEdge {
        ProductEdge {
            id: id.to_string(),
            source: source.to_string(),
            target: target.to_string(),
            label: String::new(),
            relationship_type: RelationshipType::Association,
        }
    }

    #[test]
    fn test_orphan_detection() {
        let graph = ProductGraph {
            nodes: vec![
                make_node("a", "Node A", NodeType::Process),
                make_node("b", "Node B", NodeType::Process),
                make_node("c", "Orphan", NodeType::Process),
            ],
            edges: vec![make_edge("e1", "a", "b")],
        };

        let issues = validate(&graph);
        assert!(issues.iter().any(|i| i.rule == "orphan_node" && i.element_id == Some("c".to_string())));
    }

    #[test]
    fn test_dangling_edge_detection() {
        let graph = ProductGraph {
            nodes: vec![make_node("a", "A", NodeType::Process)],
            edges: vec![make_edge("e1", "a", "nonexistent")],
        };

        let issues = validate(&graph);
        assert!(issues.iter().any(|i| i.rule == "dangling_edge_target"));
    }
}
