//! Draw.io XML Parser
//!
//! Parses raw `.drawio` XML and extracts all `mxCell` elements into
//! a flat list of `RawCell` structs for downstream processing.

use crate::backend::error::ApiError;
use std::collections::HashMap;

/// A raw cell extracted from the Draw.io XML.
#[derive(Debug, Clone)]
pub struct RawCell {
    /// The `id` attribute.
    pub id: String,
    /// The `value` attribute (label text). May be empty or contain HTML.
    pub value: String,
    /// The `style` attribute (semicolon-separated key=value pairs).
    pub style: String,
    /// True if the cell has `vertex="1"`.
    pub is_vertex: bool,
    /// True if the cell has `edge="1"`.
    pub is_edge: bool,
    /// The `parent` attribute.
    pub parent: String,
    /// The `source` attribute (only for edges).
    pub source: Option<String>,
    /// The `target` attribute (only for edges).
    pub target: Option<String>,
    /// Parsed style properties for easy lookup.
    pub style_map: HashMap<String, String>,
}

/// Parse Draw.io XML content and return a list of raw cells.
pub fn parse_drawio_xml(xml: &str) -> Result<Vec<RawCell>, ApiError> {
    let doc = roxmltree::Document::parse(xml)
        .map_err(|e| ApiError::BadRequest(format!("Invalid Draw.io XML: {}", e)))?;

    let mut cells = Vec::new();

    for node in doc.descendants() {
        if node.tag_name().name() != "mxCell" {
            continue;
        }

        let id = node.attribute("id").unwrap_or("").to_string();

        // Skip the root cells (id="0" and id="1") — they are structural placeholders.
        if id == "0" || id == "1" {
            continue;
        }

        let style_raw = node.attribute("style").unwrap_or("").to_string();
        let style_map = parse_style(&style_raw);

        cells.push(RawCell {
            id,
            value: strip_html_tags(node.attribute("value").unwrap_or("")),
            style: style_raw,
            is_vertex: node.attribute("vertex") == Some("1"),
            is_edge: node.attribute("edge") == Some("1"),
            parent: node.attribute("parent").unwrap_or("1").to_string(),
            source: node.attribute("source").map(|s| s.to_string()),
            target: node.attribute("target").map(|s| s.to_string()),
            style_map,
        });
    }

    if cells.is_empty() {
        return Err(ApiError::BadRequest(
            "Diagram contains no drawable elements (only root placeholders found).".into(),
        ));
    }

    Ok(cells)
}

/// Parse a Draw.io style string like `"shape=cylinder3;whiteSpace=wrap;html=1;"`
/// into a HashMap.
fn parse_style(style: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for part in style.split(';') {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }
        if let Some((key, val)) = part.split_once('=') {
            map.insert(key.to_string(), val.to_string());
        } else {
            // Bare keyword like "ellipse" or "rhombus"
            map.insert(part.to_string(), String::new());
        }
    }
    map
}

/// Naively strip HTML tags from a value string.
/// Draw.io often wraps labels in `<div>`, `<b>`, `<br>`, etc.
fn strip_html_tags(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut in_tag = false;
    for ch in s.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => result.push(ch),
            _ => {}
        }
    }
    result.trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_style() {
        let map = parse_style("shape=cylinder3;whiteSpace=wrap;html=1;");
        assert_eq!(map.get("shape").unwrap(), "cylinder3");
        assert_eq!(map.get("html").unwrap(), "1");
    }

    #[test]
    fn test_strip_html() {
        assert_eq!(strip_html_tags("<b>Hello</b>"), "Hello");
        assert_eq!(strip_html_tags("<div>A<br>B</div>"), "AB");
        assert_eq!(strip_html_tags("plain text"), "plain text");
    }

    #[test]
    fn test_parse_basic_xml() {
        let xml = r#"<mxfile>
  <diagram id="D1" name="Page-1">
    <mxGraphModel>
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="2" value="User" style="shape=umlActor;html=1;" vertex="1" parent="1" />
        <mxCell id="3" value="Database" style="shape=cylinder3;html=1;" vertex="1" parent="1" />
        <mxCell id="4" value="" style="edgeStyle=orthogonalEdgeStyle;" edge="1" source="2" target="3" parent="1" />
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>"#;

        let cells = parse_drawio_xml(xml).unwrap();
        assert_eq!(cells.len(), 3);
        assert!(cells[0].is_vertex);
        assert_eq!(cells[0].value, "User");
        assert!(cells[2].is_edge);
        assert_eq!(cells[2].source.as_deref(), Some("2"));
        assert_eq!(cells[2].target.as_deref(), Some("3"));
    }
}
