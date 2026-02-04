//! Sync Engine - Handles bidirectional synchronization between IDE and file system
//! 
//! This engine maps BlockSchema entities to physical TSX/CSS files and 
//! parses code changes back into the schema.

use std::path::PathBuf;
use std::fs;
use crate::schema::ProjectSchema;
use crate::generator::pascal_case;

pub struct SyncEngine {
    pub root_path: PathBuf,
}

impl SyncEngine {
    pub fn new(root_path: impl Into<PathBuf>) -> Self {
        Self {
            root_path: root_path.into(),
        }
    }

    /// Initialize the physical directory structure for a new project
    pub fn init_project_structure(&self, project: &ProjectSchema) -> std::io::Result<()> {
        // Create root
        fs::create_dir_all(&self.root_path)?;

        // Create client structure
        let client_path = self.root_path.join("client/src/features");
        fs::create_dir_all(&client_path)?;

        // Create server structure
        let server_path = self.root_path.join("server/src");
        fs::create_dir_all(&server_path)?;

        // Create grapes.config.json
        let config_path = self.root_path.join("grapes.config.json");
        let config_json = serde_json::to_string_pretty(project).unwrap();
        fs::write(config_path, config_json)?;

        Ok(())
    }

    /// Sync a page to disk
    pub fn sync_page_to_disk(&self, page_id: &str, project: &ProjectSchema) -> std::io::Result<()> {
        let page = project.find_page(page_id).ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "Page not found"))?;
        
        // Map page to feature folder
        let feature_name = page.name.to_lowercase().replace(" ", "-");
        let feature_path = self.root_path.join("client/src/features").join(&feature_name);
        fs::create_dir_all(&feature_path)?;

        let mut page_content = format!("// @grapes-page id=\"{}\"\n", page.id);
        page_content.push_str("import React from 'react';\n\n");
        page_content.push_str(&format!("export default function {}() {{\n", pascal_case(&page.name)));
        page_content.push_str("  return (\n    <div className=\"min-h-screen bg-white\">\n");

        if let Some(root_id) = &page.root_block_id {
            if let Some(block) = project.find_block(root_id) {
                if !block.archived {
                    self.append_block_to_content(&mut page_content, block, project, 3);
                }
            }
        }

        page_content.push_str("    </div>\n  );\n}");
        
        let tsx_path = feature_path.join(format!("{}.tsx", pascal_case(&page.name)));
        fs::write(tsx_path, page_content)?;

        Ok(())
    }

    fn append_block_to_content(&self, content: &mut String, block: &crate::schema::BlockSchema, project: &ProjectSchema, indent: usize) {
        let indent_str = "  ".repeat(indent);
        let tag = match block.block_type {
            crate::schema::BlockType::Button => "button",
            crate::schema::BlockType::Heading => "h1",
            crate::schema::BlockType::Text | crate::schema::BlockType::Paragraph => "p",
            _ => "div",
        };

        let classes = block.classes.join(" ");
        let inner_text = block.properties.get("text").and_then(|v| v.as_str()).unwrap_or("");

        content.push_str(&format!("{indent_str}/* @grapes-block id=\"{}\" */\n", block.id));
        content.push_str(&format!("{indent_str}<{tag} className=\"{classes}\">{inner_text}", tag = tag, classes = classes, inner_text = inner_text));
        
        if !block.children.is_empty() {
            content.push('\n');
            for child_id in &block.children {
                if let Some(child) = project.find_block(child_id) {
                    self.append_block_to_content(content, child, project, indent + 1);
                }
            }
            content.push_str(&format!("{indent_str}</{tag}>\n", tag = tag));
        } else {
            content.push_str(&format!("</{tag}>\n", tag = tag));
        }
        
        content.push_str(&format!("{indent_str}/* @grapes-block-end */\n"));
    }

    /// Sync the page containing a specific block to disk
    pub fn sync_page_to_disk_by_block(&self, block_id: &str, project: &ProjectSchema) -> std::io::Result<()> {
        // Find which page contains this block
        for page in &project.pages {
            if page.archived { continue; }
            
            // Check if this block is the root or reachable from root
            if let Some(root_id) = &page.root_block_id {
                if self.is_block_in_tree(block_id, root_id, project) {
                    return self.sync_page_to_disk(&page.id, project);
                }
            }
        }
        Ok(())
    }

    fn is_block_in_tree(&self, target_id: &str, current_id: &str, project: &ProjectSchema) -> bool {
        if target_id == current_id { return true; }
        if let Some(block) = project.find_block(current_id) {
            for child_id in &block.children {
                if self.is_block_in_tree(target_id, child_id, project) {
                    return true;
                }
            }
        }
        false
    }

    /// Parse all pages from disk and update the project schema
    pub fn sync_disk_to_project(&self, project: &mut ProjectSchema) -> std::io::Result<()> {
        let mut updates = Vec::new();

        // 1. Collect all updates first (immutable phase)
        for page in &project.pages {
            if page.archived { continue; }

            let feature_name = page.name.to_lowercase().replace(" ", "-");
            let tsx_path = self.root_path.join("client/src/features").join(&feature_name).join(format!("{}.tsx", pascal_case(&page.name)));

            if tsx_path.exists() {
                let content = fs::read_to_string(tsx_path)?;
                let parsed_blocks = self.parse_file_to_blocks(&content);
                updates.push(parsed_blocks);
            }
        }

        // 2. Apply updates (mutable phase)
        for parsed_blocks in updates {
            for parsed_block in parsed_blocks {
                if let Some(existing_block) = project.find_block_mut(&parsed_block.id) {
                    existing_block.block_type = parsed_block.block_type;
                    existing_block.classes = parsed_block.classes;
                    existing_block.properties = parsed_block.properties;
                }
            }
        }
        Ok(())
    }

    /// Parse a TSX file and update the project schema based on markers
    pub fn parse_file_to_blocks(&self, file_content: &str) -> Vec<crate::schema::BlockSchema> {
        let mut blocks = Vec::new();
        
        // Regex for block markers
        let block_re = regex::Regex::new(r#"(?s)/\* @grapes-block id="([^"]+)" \*/(.*?)/\* @grapes-block-end \*/"#).unwrap();
        // Regex for basic prop extraction from the first tag in the block
        // Matches <tag className="...">Content</tag>
        let prop_re = regex::Regex::new(r#"<([a-z0-9]+)\s+className="([^"]*)"\s*>(.*?)</\1>"#).unwrap();

        for cap in block_re.captures_iter(file_content) {
            let id = cap[1].to_string();
            let inner_content = &cap[2].trim();
            
            // Default block
            let mut block = crate::schema::BlockSchema::new(id, crate::schema::BlockType::Container, "Synced Block");
            
            // Try to extract metadata from the tag
            if let Some(prop_cap) = prop_re.captures(inner_content) {
                let tag = &prop_cap[1];
                let classes = &prop_cap[2];
                let text = &prop_cap[3];
                
                block.block_type = match tag {
                    "button" => crate::schema::BlockType::Button,
                    "h1" | "h2" | "h3" => crate::schema::BlockType::Heading,
                    "p" => crate::schema::BlockType::Paragraph,
                    _ => crate::schema::BlockType::Container,
                };
                
                block.classes = classes.split_whitespace().map(|s| s.to_string()).collect();
                if !text.contains('<') { // Only set text if it doesn't contain other tags
                    block.properties.insert("text".into(), serde_json::Value::String(text.to_string()));
                }
            }
            
            blocks.push(block);
        }
        
        blocks
    }
}
