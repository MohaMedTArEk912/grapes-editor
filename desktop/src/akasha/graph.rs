//! Product Graph — The structured intermediate representation
//!
//! This is the **single source of truth** that downstream consumers
//! (AI layer, project summary, validation) operate on.

use serde::Serialize;
use std::collections::HashMap;

use super::parser::RawCell;

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

/// Semantic type of a node in the product architecture.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum NodeType {
    Actor,
    Feature,
    Screen,
    Api,
    Database,
    ExternalService,
    Decision,
    Process,
    /// Type could not be inferred — flagged for human review.
    Unknown,
}

/// How an edge connects two nodes.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RelationshipType {
    /// A directed data/control flow.
    Flow,
    /// A dependency link.
    Dependency,
    /// A generic association (default).
    Association,
}

// ────────────────────────────────────────────────────────────────────────────
// Structs
// ────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct ProductNode {
    pub id: String,
    pub label: String,
    pub node_type: NodeType,
    /// Original Draw.io style properties preserved for reference.
    pub properties: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProductEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub label: String,
    pub relationship_type: RelationshipType,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProductGraph {
    pub nodes: Vec<ProductNode>,
    pub edges: Vec<ProductEdge>,
}

// ────────────────────────────────────────────────────────────────────────────
// Builder
// ────────────────────────────────────────────────────────────────────────────

/// Build a `ProductGraph` from a flat list of parsed `RawCell`s.
///
/// Vertices become `ProductNode`s (with `Unknown` type initially).
/// Edges become `ProductEdge`s.
pub fn build_graph(cells: &[RawCell]) -> ProductGraph {
    let mut nodes = Vec::new();
    let mut edges = Vec::new();

    for cell in cells {
        if cell.is_edge {
            edges.push(ProductEdge {
                id: cell.id.clone(),
                source: cell.source.clone().unwrap_or_default(),
                target: cell.target.clone().unwrap_or_default(),
                label: cell.value.clone(),
                relationship_type: RelationshipType::Association,
            });
        } else if cell.is_vertex {
            nodes.push(ProductNode {
                id: cell.id.clone(),
                label: cell.value.clone(),
                node_type: NodeType::Unknown, // will be inferred later
                properties: cell.style_map.clone(),
            });
        }
        // cells that are neither vertex nor edge are ignored (e.g. groups)
    }

    ProductGraph { nodes, edges }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::akasha::parser::parse_drawio_xml;

    #[test]
    fn test_build_graph_separates_nodes_and_edges() {
        let xml = r#"<mxfile>
  <diagram id="D1" name="Page-1">
    <mxGraphModel>
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="a" value="Login Screen" style="rounded=1;" vertex="1" parent="1" />
        <mxCell id="b" value="Auth API" style="shape=mxgraph.aws3.lambda;" vertex="1" parent="1" />
        <mxCell id="c" value="" edge="1" source="a" target="b" parent="1" />
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>"#;

        let cells = parse_drawio_xml(xml).unwrap();
        let graph = build_graph(&cells);

        assert_eq!(graph.nodes.len(), 2);
        assert_eq!(graph.edges.len(), 1);
        assert_eq!(graph.edges[0].source, "a");
        assert_eq!(graph.edges[0].target, "b");
        // Types are Unknown until analyzer runs
        assert!(graph.nodes.iter().all(|n| n.node_type == NodeType::Unknown));
    }
}
