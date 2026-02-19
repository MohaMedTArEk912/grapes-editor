//! Semantic Analyzer — Rule-based type inference
//!
//! Infers `NodeType` for each node in the product graph based on:
//! 1. Draw.io shape/style properties
//! 2. Label text patterns
//! 3. Connection patterns
//!
//! Nodes that cannot be confidently classified are left as `Unknown`
//! and flagged for human review rather than guessed.

use super::graph::{NodeType, ProductGraph, RelationshipType};

/// Run rule-based type inference on all nodes in the graph.
pub fn infer_types(graph: &mut ProductGraph) {
    for node in &mut graph.nodes {
        node.node_type = infer_node_type(&node.label, &node.properties);
    }

    // Second pass: infer edge relationship types based on connected node types
    infer_edge_types(graph);
}

/// Infer the semantic type of a single node from its style and label.
fn infer_node_type(
    label: &str,
    properties: &std::collections::HashMap<String, String>,
) -> NodeType {
    let label_lower = label.to_lowercase();
    let shape = properties.get("shape").map(|s| s.as_str()).unwrap_or("");

    // ── Shape-based rules (highest confidence) ──────────────────────────
    // Actor shapes
    if shape.contains("umlActor")
        || shape.contains("mxgraph.people")
        || shape.contains("actor")
    {
        return NodeType::Actor;
    }

    // Database / cylinder shapes
    if shape.contains("cylinder")
        || shape.contains("database")
        || shape.contains("datastore")
    {
        return NodeType::Database;
    }

    // Decision / diamond shapes
    if shape.contains("rhombus") || properties.contains_key("rhombus") {
        return NodeType::Decision;
    }

    // Cloud / external service shapes
    if shape.contains("cloud")
        || shape.contains("mxgraph.aws")
        || shape.contains("mxgraph.azure")
        || shape.contains("mxgraph.gcp")
    {
        return NodeType::ExternalService;
    }

    // Screen / UI shapes
    if shape.contains("mxgraph.mockup")
        || shape.contains("mxgraph.ios")
        || shape.contains("mxgraph.android")
        || shape.contains("browser")
    {
        return NodeType::Screen;
    }

    // ── Label-based rules (medium confidence) ───────────────────────────

    // Database patterns (check before Actor — "Users DB" contains "user" but is a database)
    if label_lower.contains("database")
        || label_lower.contains(" db")
        || label_lower.ends_with("db")
        || label_lower.contains("storage")
        || label_lower.contains("datastore")
        || label_lower.contains("table")
        || label_lower.contains("collection")
    {
        return NodeType::Database;
    }

    // Actor patterns
    if label_lower.starts_with("user")
        || label_lower.starts_with("admin")
        || label_lower.starts_with("customer")
        || label_lower.starts_with("actor")
        || label_lower.starts_with("client")
    {
        return NodeType::Actor;
    }

    // API patterns
    if label_lower.contains("api")
        || label_lower.contains("endpoint")
        || label_lower.contains("rest")
        || label_lower.contains("graphql")
        || label_lower.contains("webhook")
        || label_lower.contains("gateway")
    {
        return NodeType::Api;
    }

    // Screen / UI patterns
    if label_lower.contains("screen")
        || label_lower.contains("page")
        || label_lower.contains("view")
        || label_lower.contains("dialog")
        || label_lower.contains("modal")
        || label_lower.contains("form")
        || label_lower.contains("dashboard")
    {
        return NodeType::Screen;
    }

    // Decision patterns
    if label_lower.starts_with("if ")
        || label_lower.starts_with("is ")
        || label_lower.ends_with("?")
        || label_lower.contains("decision")
        || label_lower.contains("check")
    {
        return NodeType::Decision;
    }

    // External service patterns
    if label_lower.contains("external")
        || label_lower.contains("third-party")
        || label_lower.contains("3rd party")
        || label_lower.contains("service")
        || label_lower.contains("provider")
        || label_lower.contains("smtp")
        || label_lower.contains("payment")
        || label_lower.contains("stripe")
        || label_lower.contains("aws")
        || label_lower.contains("firebase")
    {
        return NodeType::ExternalService;
    }

    // Feature patterns
    if label_lower.contains("feature")
        || label_lower.contains("module")
        || label_lower.contains("capability")
    {
        return NodeType::Feature;
    }

    // Process — catch-all for remaining vertices that have a label
    // but don't match specific patterns. They represent generic process steps.
    if !label.is_empty() {
        // Check if it looks like a process/action (verb-like label)
        let has_rounded = properties.get("rounded").map(|v| v == "1").unwrap_or(false);
        if has_rounded {
            return NodeType::Process;
        }
    }

    // Cannot determine — flag for review
    NodeType::Unknown
}

/// Infer edge relationship types based on the nodes they connect.
fn infer_edge_types(graph: &mut ProductGraph) {
    // Build a lookup of node id → type
    let node_types: std::collections::HashMap<String, NodeType> = graph
        .nodes
        .iter()
        .map(|n| (n.id.clone(), n.node_type.clone()))
        .collect();

    for edge in &mut graph.edges {
        let source_type = node_types.get(&edge.source);
        let target_type = node_types.get(&edge.target);

        edge.relationship_type = match (source_type, target_type) {
            // Actor → Screen/Feature = user flow
            (Some(NodeType::Actor), Some(NodeType::Screen | NodeType::Feature)) => {
                RelationshipType::Flow
            }
            // Screen → API or API → Database = dependency
            (Some(NodeType::Screen), Some(NodeType::Api))
            | (Some(NodeType::Api), Some(NodeType::Database))
            | (Some(NodeType::Feature), Some(NodeType::Api)) => {
                RelationshipType::Dependency
            }
            // Decision → anything = flow
            (Some(NodeType::Decision), _) | (_, Some(NodeType::Decision)) => {
                RelationshipType::Flow
            }
            // Default
            _ => RelationshipType::Association,
        };
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_actor_by_shape() {
        let mut props = HashMap::new();
        props.insert("shape".to_string(), "umlActor".to_string());
        assert_eq!(infer_node_type("Anything", &props), NodeType::Actor);
    }

    #[test]
    fn test_database_by_label() {
        let props = HashMap::new();
        assert_eq!(infer_node_type("Users DB", &props), NodeType::Database);
    }

    #[test]
    fn test_api_by_label() {
        let props = HashMap::new();
        assert_eq!(infer_node_type("Auth API", &props), NodeType::Api);
    }

    #[test]
    fn test_decision_by_question_mark() {
        let props = HashMap::new();
        assert_eq!(
            infer_node_type("Is authenticated?", &props),
            NodeType::Decision
        );
    }

    #[test]
    fn test_unknown_for_ambiguous_label() {
        let props = HashMap::new();
        assert_eq!(infer_node_type("", &props), NodeType::Unknown);
    }

    #[test]
    fn test_screen_by_label() {
        let props = HashMap::new();
        assert_eq!(
            infer_node_type("Login Screen", &props),
            NodeType::Screen
        );
    }
}
