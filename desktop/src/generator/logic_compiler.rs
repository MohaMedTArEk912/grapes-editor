//! Logic Flow Compiler
//!
//! Compiles visual LogicFlowSchema graphs into executable TypeScript functions.
//! Supports both frontend (React event handlers) and backend (NestJS handler bodies).

use crate::schema::logic_flow::{LogicFlowSchema, LogicNode, LogicNodeType, FlowContext};
use std::collections::HashMap;

pub struct LogicCompiler;

impl LogicCompiler {
    /// Compile all logic flows in a project to TypeScript files.
    pub fn compile_all(flows: &[LogicFlowSchema]) -> Vec<CompiledFlow> {
        flows.iter()
            .filter(|f| !f.archived)
            .map(|f| Self::compile(f))
            .collect()
    }

    /// Compile a single logic flow to a TypeScript function.
    pub fn compile(flow: &LogicFlowSchema) -> CompiledFlow {
        let node_map: HashMap<&str, &LogicNode> = flow.nodes.iter()
            .map(|n| (n.id.as_str(), n))
            .collect();

        let fn_name = to_camel_case(&flow.name);
        let mut body = String::new();

        // Walk the graph from entry node
        if let Some(entry_id) = &flow.entry_node_id {
            Self::walk_node(entry_id, &node_map, &mut body, 1, &mut Vec::new());
        }

        let (params, is_async) = match flow.context {
            FlowContext::Backend => ("req: any, res: any", true),
            FlowContext::Frontend => ("event?: any", true),
        };

        let code = format!(
            "export {async_kw}function {fn_name}({params}) {{\n{body}}}\n",
            async_kw = if is_async { "async " } else { "" },
            fn_name = fn_name,
            params = params,
            body = body,
        );

        let path = match flow.context {
            FlowContext::Backend => format!("src/logic/{}.ts", fn_name),
            FlowContext::Frontend => format!("src/logic/{}.ts", fn_name),
        };

        CompiledFlow {
            flow_id: flow.id.clone(),
            path,
            code,
            context: flow.context.clone(),
        }
    }

    fn walk_node(
        node_id: &str,
        nodes: &HashMap<&str, &LogicNode>,
        out: &mut String,
        indent: usize,
        visited: &mut Vec<String>,
    ) {
        // Prevent infinite loops
        if visited.contains(&node_id.to_string()) {
            let pad = "  ".repeat(indent);
            out.push_str(&format!("{pad}// cycle detected, skipping {node_id}\n"));
            return;
        }
        visited.push(node_id.to_string());

        let node = match nodes.get(node_id) {
            Some(n) => n,
            None => return,
        };

        let pad = "  ".repeat(indent);
        let label_comment = node.label.as_deref().unwrap_or("");
        if !label_comment.is_empty() {
            out.push_str(&format!("{pad}// {label_comment}\n"));
        }

        match &node.node_type {
            // ── Control flow ─────────────────────────────
            LogicNodeType::Condition => {
                let left = node.data.get("left").and_then(|v| v.as_str()).unwrap_or("true");
                let op = node.data.get("operator").and_then(|v| v.as_str()).unwrap_or("===");
                let right = data_value_to_js(&node.data.get("right").cloned().unwrap_or(serde_json::Value::Bool(true)));

                out.push_str(&format!("{pad}if ({left} {op} {right}) {{\n"));
                for next_id in &node.next_nodes {
                    Self::walk_node(next_id, nodes, out, indent + 1, visited);
                }
                out.push_str(&format!("{pad}}}"));
                if !node.else_nodes.is_empty() {
                    out.push_str(" else {\n");
                    for else_id in &node.else_nodes {
                        Self::walk_node(else_id, nodes, out, indent + 1, visited);
                    }
                    out.push_str(&format!("{pad}}}"));
                }
                out.push('\n');
                return; // already handled children
            }

            LogicNodeType::ForEach => {
                let arr = node.data.get("array").and_then(|v| v.as_str()).unwrap_or("items");
                let item = node.data.get("itemName").and_then(|v| v.as_str()).unwrap_or("item");
                out.push_str(&format!("{pad}for (const {item} of {arr}) {{\n"));
                for next_id in &node.next_nodes {
                    Self::walk_node(next_id, nodes, out, indent + 1, visited);
                }
                out.push_str(&format!("{pad}}}\n"));
                return;
            }

            LogicNodeType::While => {
                let cond = node.data.get("condition").and_then(|v| v.as_str()).unwrap_or("true");
                out.push_str(&format!("{pad}while ({cond}) {{\n"));
                for next_id in &node.next_nodes {
                    Self::walk_node(next_id, nodes, out, indent + 1, visited);
                }
                out.push_str(&format!("{pad}}}\n"));
                return;
            }

            LogicNodeType::Delay => {
                let ms = node.data.get("ms").and_then(|v| v.as_u64()).unwrap_or(1000);
                out.push_str(&format!("{pad}await new Promise(r => setTimeout(r, {ms}));\n"));
            }

            LogicNodeType::TryCatch => {
                out.push_str(&format!("{pad}try {{\n"));
                for next_id in &node.next_nodes {
                    Self::walk_node(next_id, nodes, out, indent + 1, visited);
                }
                out.push_str(&format!("{pad}}} catch (error) {{\n"));
                for else_id in &node.else_nodes {
                    Self::walk_node(else_id, nodes, out, indent + 1, visited);
                }
                out.push_str(&format!("{pad}}}\n"));
                return;
            }

            // ── Variables ────────────────────────────────
            LogicNodeType::SetVariable => {
                let name = node.data.get("variableName").and_then(|v| v.as_str()).unwrap_or("result");
                let val = data_value_to_js(&node.data.get("value").cloned().unwrap_or(serde_json::Value::Null));
                out.push_str(&format!("{pad}let {name} = {val};\n"));
            }

            LogicNodeType::GetVariable => {
                let name = node.data.get("variableName").and_then(|v| v.as_str()).unwrap_or("result");
                out.push_str(&format!("{pad}const _val = {name};\n"));
            }

            LogicNodeType::Transform => {
                let expr = node.data.get("expression").and_then(|v| v.as_str()).unwrap_or("data");
                let target = node.data.get("target").and_then(|v| v.as_str()).unwrap_or("result");
                out.push_str(&format!("{pad}const {target} = {expr};\n"));
            }

            // ── UI actions (frontend) ────────────────────
            LogicNodeType::Navigate => {
                let path = node.data.get("path").and_then(|v| v.as_str()).unwrap_or("/");
                out.push_str(&format!("{pad}window.location.href = '{path}';\n"));
            }

            LogicNodeType::Alert => {
                let msg = node.data.get("message").and_then(|v| v.as_str()).unwrap_or("Alert");
                let kind = node.data.get("type").and_then(|v| v.as_str()).unwrap_or("info");
                out.push_str(&format!("{pad}console.{kind}('{msg}'); // TODO: use toast/notification library\n",
                    kind = if kind == "error" { "error" } else { "log" }));
            }

            LogicNodeType::OpenModal => {
                let id = node.data.get("modalId").and_then(|v| v.as_str()).unwrap_or("modal");
                out.push_str(&format!("{pad}document.getElementById('{id}')?.classList.remove('hidden');\n"));
            }

            LogicNodeType::CloseModal => {
                let id = node.data.get("modalId").and_then(|v| v.as_str()).unwrap_or("modal");
                out.push_str(&format!("{pad}document.getElementById('{id}')?.classList.add('hidden');\n"));
            }

            LogicNodeType::ToggleClass => {
                let target = node.data.get("target").and_then(|v| v.as_str()).unwrap_or("el");
                let class = node.data.get("className").and_then(|v| v.as_str()).unwrap_or("active");
                out.push_str(&format!("{pad}document.querySelector('{target}')?.classList.toggle('{class}');\n"));
            }

            LogicNodeType::SetProperty => {
                let target = node.data.get("target").and_then(|v| v.as_str()).unwrap_or("el");
                let prop = node.data.get("property").and_then(|v| v.as_str()).unwrap_or("textContent");
                let val = data_value_to_js(&node.data.get("value").cloned().unwrap_or(serde_json::Value::String("".into())));
                out.push_str(&format!("{pad}(document.querySelector('{target}') as any).{prop} = {val};\n"));
            }

            // ── API/HTTP actions ─────────────────────────
            LogicNodeType::FetchApi => {
                let url = node.data.get("url").and_then(|v| v.as_str()).unwrap_or("/api/data");
                let method = node.data.get("method").and_then(|v| v.as_str()).unwrap_or("GET");
                let target = node.data.get("resultVar").and_then(|v| v.as_str()).unwrap_or("apiResult");
                if method == "GET" {
                    out.push_str(&format!("{pad}const {target} = await fetch('{url}').then(r => r.json());\n"));
                } else {
                    out.push_str(&format!("{pad}const {target} = await fetch('{url}', {{ method: '{method}', headers: {{ 'Content-Type': 'application/json' }}, body: JSON.stringify(data) }}).then(r => r.json());\n"));
                }
            }

            LogicNodeType::HttpRequest => {
                let url = node.data.get("url").and_then(|v| v.as_str()).unwrap_or("https://api.example.com");
                let method = node.data.get("method").and_then(|v| v.as_str()).unwrap_or("GET");
                let target = node.data.get("resultVar").and_then(|v| v.as_str()).unwrap_or("httpResult");
                out.push_str(&format!("{pad}const {target} = await fetch('{url}', {{ method: '{method}' }}).then(r => r.json());\n"));
            }

            // ── DB operations (backend) ──────────────────
            LogicNodeType::DbCreate => {
                let model = node.data.get("model").and_then(|v| v.as_str()).unwrap_or("record");
                let camel = to_camel_case_single(model);
                out.push_str(&format!("{pad}const created = await prisma.{camel}.create({{ data: req.body }});\n"));
            }

            LogicNodeType::DbRead => {
                let model = node.data.get("model").and_then(|v| v.as_str()).unwrap_or("record");
                let camel = to_camel_case_single(model);
                let many = node.data.get("findMany").and_then(|v| v.as_bool()).unwrap_or(true);
                if many {
                    out.push_str(&format!("{pad}const records = await prisma.{camel}.findMany();\n"));
                } else {
                    out.push_str(&format!("{pad}const record = await prisma.{camel}.findUnique({{ where: {{ id: req.params.id }} }});\n"));
                }
            }

            LogicNodeType::DbUpdate => {
                let model = node.data.get("model").and_then(|v| v.as_str()).unwrap_or("record");
                let camel = to_camel_case_single(model);
                out.push_str(&format!("{pad}const updated = await prisma.{camel}.update({{ where: {{ id: req.params.id }}, data: req.body }});\n"));
            }

            LogicNodeType::DbDelete => {
                let model = node.data.get("model").and_then(|v| v.as_str()).unwrap_or("record");
                let camel = to_camel_case_single(model);
                out.push_str(&format!("{pad}await prisma.{camel}.delete({{ where: {{ id: req.params.id }} }});\n"));
            }

            // ── Response (backend) ───────────────────────
            LogicNodeType::Return => {
                let status = node.data.get("status").and_then(|v| v.as_u64()).unwrap_or(200);
                let data = data_value_to_js(&node.data.get("data").cloned().unwrap_or(serde_json::json!({"ok": true})));
                out.push_str(&format!("{pad}return res.status({status}).json({data});\n"));
            }

            LogicNodeType::ThrowError => {
                let msg = node.data.get("message").and_then(|v| v.as_str()).unwrap_or("An error occurred");
                let status = node.data.get("status").and_then(|v| v.as_u64()).unwrap_or(500);
                out.push_str(&format!("{pad}throw {{ statusCode: {status}, message: '{msg}' }};\n"));
            }

            // ── Integrations ─────────────────────────────
            LogicNodeType::SendEmail => {
                let to = node.data.get("to").and_then(|v| v.as_str()).unwrap_or("user@example.com");
                let subject = node.data.get("subject").and_then(|v| v.as_str()).unwrap_or("Hello");
                let body_text = node.data.get("body").and_then(|v| v.as_str()).unwrap_or("Email body");
                out.push_str(&format!("{pad}// TODO: configure email service (SendGrid/SES/SMTP)\n"));
                out.push_str(&format!("{pad}console.log('Send email to: {to}, subject: {subject}');\n"));
                out.push_str(&format!("{pad}// await emailService.send({{ to: '{to}', subject: '{subject}', body: '{body_text}' }});\n"));
            }

            // ── Custom code ──────────────────────────────
            LogicNodeType::CustomCode => {
                let code = node.data.get("code").and_then(|v| v.as_str()).unwrap_or("// custom code");
                for line in code.lines() {
                    out.push_str(&format!("{pad}{line}\n"));
                }
            }
        }

        // Walk next nodes (sequential flow)
        for next_id in &node.next_nodes {
            Self::walk_node(next_id, nodes, out, indent, visited);
        }
    }
}

// ── Output types ─────────────────────────────────────────

pub struct CompiledFlow {
    pub flow_id: String,
    pub path: String,
    pub code: String,
    pub context: FlowContext,
}

// ── Helpers ──────────────────────────────────────────────

fn data_value_to_js(val: &serde_json::Value) -> String {
    match val {
        serde_json::Value::Null => "null".into(),
        serde_json::Value::Bool(b) => b.to_string(),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::String(s) => format!("'{}'", s.replace('\'', "\\'")),
        serde_json::Value::Array(arr) => {
            let items: Vec<String> = arr.iter().map(data_value_to_js).collect();
            format!("[{}]", items.join(", "))
        }
        serde_json::Value::Object(obj) => {
            let entries: Vec<String> = obj.iter()
                .map(|(k, v)| format!("{}: {}", k, data_value_to_js(v)))
                .collect();
            format!("{{ {} }}", entries.join(", "))
        }
    }
}

fn to_camel_case(s: &str) -> String {
    let words: Vec<&str> = s.split(|c: char| !c.is_alphanumeric()).filter(|w| !w.is_empty()).collect();
    let mut result = String::new();
    for (i, word) in words.iter().enumerate() {
        if i == 0 {
            result.push_str(&word.to_lowercase());
        } else {
            let mut chars = word.chars();
            if let Some(first) = chars.next() {
                result.push(first.to_ascii_uppercase());
                result.extend(chars.map(|c| c.to_ascii_lowercase()));
            }
        }
    }
    result
}

fn to_camel_case_single(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(c) => c.to_lowercase().chain(chars).collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::logic_flow::{TriggerType, FlowContext, LogicNode, LogicNodeType, ActionData, NodePosition};

    #[test]
    fn test_compile_simple_flow() {
        let flow = LogicFlowSchema::new(
            "flow-1",
            "Handle Click",
            TriggerType::Manual,
            FlowContext::Frontend,
        )
        .with_node(
            LogicNode::new("n1", LogicNodeType::Alert, ActionData::alert("Hello", "info"))
                .with_label("Show greeting")
        );

        let compiled = LogicCompiler::compile(&flow);
        assert!(compiled.code.contains("function handleClick"));
        assert!(compiled.code.contains("console.log"));
    }

    #[test]
    fn test_compile_backend_crud() {
        let flow = LogicFlowSchema::new(
            "flow-2",
            "list users handler",
            TriggerType::Api { api_id: "api-1".into() },
            FlowContext::Backend,
        )
        .with_node(
            LogicNode::new("n1", LogicNodeType::DbRead, ActionData::db_read("User", None))
                .with_label("Fetch all users")
                .then("n2")
        )
        .with_node(
            LogicNode::new("n2", LogicNodeType::Return, ActionData::return_response(200, serde_json::json!({"ok": true})))
                .with_label("Return data")
        );

        let compiled = LogicCompiler::compile(&flow);
        assert!(compiled.code.contains("prisma.user.findMany"));
        assert!(compiled.code.contains("res.status(200)"));
    }

    #[test]
    fn test_compile_condition() {
        let flow = LogicFlowSchema::new(
            "flow-3",
            "Check Admin",
            TriggerType::Manual,
            FlowContext::Backend,
        )
        .with_node(
            LogicNode::new("n1", LogicNodeType::Condition, ActionData::condition("role", "===", serde_json::json!("admin")))
                .with_label("Is admin?")
                .then("n2")
                .otherwise("n3")
        )
        .with_node(
            LogicNode::new("n2", LogicNodeType::Return, ActionData::return_response(200, serde_json::json!({"admin": true})))
                .with_label("Admin response")
        )
        .with_node(
            LogicNode::new("n3", LogicNodeType::ThrowError, serde_json::json!({"message": "Unauthorized", "status": 403}))
                .with_label("Deny access")
        );

        let compiled = LogicCompiler::compile(&flow);
        assert!(compiled.code.contains("if (role === 'admin')"));
        assert!(compiled.code.contains("else"));
    }
}
