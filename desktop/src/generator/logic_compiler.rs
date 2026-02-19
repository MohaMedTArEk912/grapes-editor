//! Logic flow compiler and runtime bundle generator.
//!
//! Compiles visual `LogicFlowSchema` graphs into executable TypeScript
//! functions that all share the same `FlowInput -> FlowOutput` contract.

use std::collections::HashMap;

use crate::generator::flow_wiring::FlowWiring;
use crate::schema::logic_flow::{FlowContext, LogicFlowSchema, LogicNode, LogicNodeType};

pub struct LogicCompiler;

#[derive(Debug, Clone)]
pub struct LogicBundle {
    pub context: FlowContext,
    pub files: Vec<CompiledFlowFile>,
}

#[derive(Debug, Clone)]
pub struct CompiledFlowFile {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Clone)]
pub struct CompiledFlow {
    pub flow_id: String,
    pub path: String,
    pub function_name: String,
    pub code: String,
    pub context: FlowContext,
}

impl LogicCompiler {
    /// Compile all flows for one runtime context and emit a complete logic bundle.
    pub fn compile_bundle(
        flows: &[LogicFlowSchema],
        context: FlowContext,
        wiring: &FlowWiring,
    ) -> LogicBundle {
        let mut flow_defs: Vec<&LogicFlowSchema> = flows
            .iter()
            .filter(|f| !f.archived && f.context == context)
            .collect();
        flow_defs.sort_by(|a, b| a.id.cmp(&b.id));

        let compiled_flows: Vec<CompiledFlow> =
            flow_defs.iter().map(|f| Self::compile(f)).collect();

        let mut files = Vec::new();
        files.push(CompiledFlowFile {
            path: "src/logic/flow-contract.ts".into(),
            content: Self::gen_flow_contract(),
        });
        files.push(CompiledFlowFile {
            path: "src/logic/flow-registry.ts".into(),
            content: Self::gen_flow_registry(&compiled_flows),
        });
        files.push(CompiledFlowFile {
            path: "src/logic/flow-runner.ts".into(),
            content: Self::gen_flow_runner(),
        });
        files.push(CompiledFlowFile {
            path: "src/logic/schedule-runner.ts".into(),
            content: Self::gen_schedule_runner(&context, wiring),
        });
        files.push(CompiledFlowFile {
            path: "src/logic/index.ts".into(),
            content: Self::gen_logic_index(),
        });

        for flow in compiled_flows {
            files.push(CompiledFlowFile {
                path: flow.path,
                content: flow.code,
            });
        }

        LogicBundle { context, files }
    }

    /// Compile a single flow to a namespaced TS handler file.
    pub fn compile(flow: &LogicFlowSchema) -> CompiledFlow {
        let node_map: HashMap<&str, &LogicNode> =
            flow.nodes.iter().map(|n| (n.id.as_str(), n)).collect();

        let function_name = handler_name_for_flow_id(&flow.id);
        let mut body = String::new();

        if let Some(entry_id) = &flow.entry_node_id {
            Self::walk_node(entry_id, &node_map, &mut body, 2, &mut Vec::new());
        }

        let code = format!(
            "import type {{ FlowInput, FlowOutput }} from './flow-contract';\n\n\
export async function {function_name}(input: FlowInput): Promise<FlowOutput> {{\n\
  const payload = input.payload;\n\
  const event = input.context?.event;\n\
  const req = input.context?.req as any;\n\
  const res = input.context?.res as any;\n\
  const prisma = req?.prisma;\n\
  const state: Record<string, any> = {{}};\n\
  try {{\n\
{body}\
    return {{ data: state.result ?? payload ?? null }};\n\
  }} catch (error: any) {{\n\
    return {{ error: error?.message ?? String(error) }};\n\
  }}\n\
}}\n",
            function_name = function_name,
            body = body,
        );

        CompiledFlow {
            flow_id: flow.id.clone(),
            path: format!("src/logic/{}.ts", function_name),
            function_name,
            code,
            context: flow.context.clone(),
        }
    }

    fn gen_flow_contract() -> String {
        r#"export type FlowTrigger = 'event' | 'api' | 'mount' | 'schedule' | 'manual';

export interface FlowInput {
  trigger: FlowTrigger;
  payload?: any;
  context?: {
    event?: any;
    req?: any;
    res?: any;
  };
}

export interface FlowOutput {
  data?: any;
  error?: string;
}
"#
        .into()
    }

    fn gen_flow_registry(compiled_flows: &[CompiledFlow]) -> String {
        let mut imports = String::new();
        let mut entries = String::new();

        for flow in compiled_flows {
            let module_name = flow
                .path
                .strip_prefix("src/logic/")
                .unwrap_or(&flow.path)
                .trim_end_matches(".ts");
            imports.push_str(&format!(
                "import {{ {} }} from './{}';\n",
                flow.function_name, module_name
            ));
            entries.push_str(&format!(
                "  {}: {},\n",
                js_string(&flow.flow_id),
                flow.function_name
            ));
        }

        format!(
            "import type {{ FlowInput, FlowOutput }} from './flow-contract';\n\
{imports}\n\
export type FlowHandler = (input: FlowInput) => Promise<FlowOutput>;\n\n\
export const flowRegistry: Record<string, FlowHandler> = {{\n\
{entries}}};\n",
            imports = imports,
            entries = entries,
        )
    }

    fn gen_flow_runner() -> String {
        r#"import type { FlowInput, FlowOutput } from './flow-contract';
import { flowRegistry } from './flow-registry';

export async function runFlow(flowId: string, input: FlowInput): Promise<FlowOutput> {
  const handler = flowRegistry[flowId];
  if (!handler) {
    return { error: `Unknown flow: ${flowId}` };
  }

  try {
    return await handler(input);
  } catch (error: any) {
    return { error: error?.message ?? String(error) };
  }
}
"#
        .into()
    }

    fn gen_schedule_runner(context: &FlowContext, wiring: &FlowWiring) -> String {
        let entries = if *context == FlowContext::Backend {
            let mut schedule = wiring.schedule.clone();
            schedule.sort_by(|a, b| a.flow_id.cmp(&b.flow_id));
            let mut out = String::new();
            for row in schedule {
                out.push_str(&format!(
                    "  {{ flowId: {}, cron: {} }},\n",
                    js_string(&row.flow_id),
                    js_string(&row.cron),
                ));
            }
            out
        } else {
            String::new()
        };

        format!(
            "import type {{ FlowOutput }} from './flow-contract';\n\
import {{ runFlow }} from './flow-runner';\n\n\
export interface ScheduleEntry {{\n\
  flowId: string;\n\
  cron: string;\n\
}}\n\n\
export const scheduleEntries: ScheduleEntry[] = [\n\
{entries}];\n\n\
// Stub runner. Integrate with a cron engine in the host app.\n\
export async function runScheduledFlow(entry: ScheduleEntry): Promise<FlowOutput> {{\n\
  return runFlow(entry.flowId, {{ trigger: 'schedule' }});\n\
}}\n",
            entries = entries,
        )
    }

    fn gen_logic_index() -> String {
        r#"export * from './flow-contract';
export * from './flow-registry';
export * from './flow-runner';
export * from './schedule-runner';
"#
        .into()
    }

    fn walk_node(
        node_id: &str,
        nodes: &HashMap<&str, &LogicNode>,
        out: &mut String,
        indent: usize,
        visited: &mut Vec<String>,
    ) {
        if visited.iter().any(|n| n == node_id) {
            let pad = "  ".repeat(indent);
            out.push_str(&format!("{pad}// cycle detected, skipping {}\n", node_id));
            return;
        }
        visited.push(node_id.to_string());

        let Some(node) = nodes.get(node_id) else {
            visited.pop();
            return;
        };

        let pad = "  ".repeat(indent);
        if let Some(label) = node.label.as_deref() {
            if !label.trim().is_empty() {
                out.push_str(&format!("{pad}// {}\n", label.trim()));
            }
        }

        match &node.node_type {
            // ── Control flow ─────────────────────────────
            LogicNodeType::Condition => {
                let left = node
                    .data
                    .get("left")
                    .and_then(|v| v.as_str())
                    .unwrap_or("true");
                let op = node
                    .data
                    .get("operator")
                    .and_then(|v| v.as_str())
                    .unwrap_or("===");
                let right = data_value_to_js(
                    &node
                        .data
                        .get("right")
                        .cloned()
                        .unwrap_or(serde_json::Value::Bool(true)),
                );

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
                visited.pop();
                return;
            }
            LogicNodeType::ForEach => {
                let arr = node
                    .data
                    .get("array")
                    .and_then(|v| v.as_str())
                    .unwrap_or("[]");
                let item = node
                    .data
                    .get("itemName")
                    .and_then(|v| v.as_str())
                    .unwrap_or("item");
                out.push_str(&format!("{pad}for (const {item} of {arr}) {{\n"));
                for next_id in &node.next_nodes {
                    Self::walk_node(next_id, nodes, out, indent + 1, visited);
                }
                out.push_str(&format!("{pad}}}\n"));
                visited.pop();
                return;
            }
            LogicNodeType::While => {
                let cond = node
                    .data
                    .get("condition")
                    .and_then(|v| v.as_str())
                    .unwrap_or("true");
                out.push_str(&format!("{pad}while ({cond}) {{\n"));
                for next_id in &node.next_nodes {
                    Self::walk_node(next_id, nodes, out, indent + 1, visited);
                }
                out.push_str(&format!("{pad}}}\n"));
                visited.pop();
                return;
            }
            LogicNodeType::Delay => {
                let ms = node.data.get("ms").and_then(|v| v.as_u64()).unwrap_or(1000);
                out.push_str(&format!(
                    "{pad}await new Promise(r => setTimeout(r, {ms}));\n"
                ));
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
                visited.pop();
                return;
            }

            // ── Variables/data ───────────────────────────
            LogicNodeType::SetVariable => {
                let name = node
                    .data
                    .get("variableName")
                    .and_then(|v| v.as_str())
                    .unwrap_or("result");
                let val = data_value_to_js(
                    &node
                        .data
                        .get("value")
                        .cloned()
                        .unwrap_or(serde_json::Value::Null),
                );
                out.push_str(&format!("{pad}state[{}] = {};\n", js_string(name), val));
            }
            LogicNodeType::GetVariable => {
                let name = node
                    .data
                    .get("variableName")
                    .and_then(|v| v.as_str())
                    .unwrap_or("result");
                out.push_str(&format!("{pad}const _val = state[{}];\n", js_string(name)));
            }
            LogicNodeType::Transform => {
                let expr = node
                    .data
                    .get("expression")
                    .and_then(|v| v.as_str())
                    .unwrap_or("payload");
                let target = node
                    .data
                    .get("target")
                    .and_then(|v| v.as_str())
                    .unwrap_or("result");
                out.push_str(&format!("{pad}state[{}] = {};\n", js_string(target), expr));
            }

            // ── UI actions ───────────────────────────────
            LogicNodeType::Navigate => {
                let path = node
                    .data
                    .get("path")
                    .and_then(|v| v.as_str())
                    .unwrap_or("/");
                out.push_str(&format!(
                    "{pad}state['navigateTo'] = {};\n",
                    js_string(path)
                ));
            }
            LogicNodeType::Alert => {
                let msg = node
                    .data
                    .get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Alert");
                let kind = node
                    .data
                    .get("type")
                    .and_then(|v| v.as_str())
                    .unwrap_or("info");
                let console_method = if kind == "error" { "error" } else { "log" };
                out.push_str(&format!(
                    "{pad}console.{console_method}({});\n",
                    js_string(msg)
                ));
            }
            LogicNodeType::OpenModal => {
                let id = node
                    .data
                    .get("modalId")
                    .and_then(|v| v.as_str())
                    .unwrap_or("modal");
                out.push_str(&format!("{pad}state['openModalId'] = {};\n", js_string(id)));
            }
            LogicNodeType::CloseModal => {
                let id = node
                    .data
                    .get("modalId")
                    .and_then(|v| v.as_str())
                    .unwrap_or("modal");
                out.push_str(&format!(
                    "{pad}state['closeModalId'] = {};\n",
                    js_string(id)
                ));
            }
            LogicNodeType::ToggleClass => {
                let target = node
                    .data
                    .get("target")
                    .and_then(|v| v.as_str())
                    .unwrap_or("el");
                let class_name = node
                    .data
                    .get("className")
                    .and_then(|v| v.as_str())
                    .unwrap_or("active");
                out.push_str(&format!(
                    "{pad}state['toggleClass'] = {{ target: {}, className: {} }};\n",
                    js_string(target),
                    js_string(class_name),
                ));
            }
            LogicNodeType::SetProperty => {
                let target = node
                    .data
                    .get("target")
                    .and_then(|v| v.as_str())
                    .unwrap_or("el");
                let prop = node
                    .data
                    .get("property")
                    .and_then(|v| v.as_str())
                    .unwrap_or("textContent");
                let val = data_value_to_js(
                    &node
                        .data
                        .get("value")
                        .cloned()
                        .unwrap_or(serde_json::Value::String(String::new())),
                );
                out.push_str(&format!(
                    "{pad}state['setProperty'] = {{ target: {}, property: {}, value: {} }};\n",
                    js_string(target),
                    js_string(prop),
                    val,
                ));
            }

            // ── API/HTTP ─────────────────────────────────
            LogicNodeType::FetchApi => {
                let url = node
                    .data
                    .get("url")
                    .and_then(|v| v.as_str())
                    .unwrap_or("/api/data");
                let method = node
                    .data
                    .get("method")
                    .and_then(|v| v.as_str())
                    .unwrap_or("GET");
                let target = node
                    .data
                    .get("resultVar")
                    .and_then(|v| v.as_str())
                    .unwrap_or("apiResult");
                out.push_str(&format!(
                    "{pad}const fetcher = (req && req.fetch) || (input as any).fetch || ((input.context as any)?.fetch);\n\
{pad}if (!fetcher) throw new Error('Fetch implementation is missing on context');\n",
                ));
                if method.eq_ignore_ascii_case("GET") {
                    out.push_str(&format!(
                        "{pad}state[{}] = await fetcher({}).then((r: any) => r.json());\n",
                        js_string(target),
                        js_string(url),
                    ));
                } else {
                    out.push_str(&format!(
                        "{pad}state[{}] = await fetcher({}, {{ method: {}, headers: {{ 'Content-Type': 'application/json' }}, body: JSON.stringify(payload ?? {{}}) }}).then((r: any) => r.json());\n",
                        js_string(target),
                        js_string(url),
                        js_string(method),
                    ));
                }
            }
            LogicNodeType::HttpRequest => {
                let url = node
                    .data
                    .get("url")
                    .and_then(|v| v.as_str())
                    .unwrap_or("https://api.example.com");
                let method = node
                    .data
                    .get("method")
                    .and_then(|v| v.as_str())
                    .unwrap_or("GET");
                let target = node
                    .data
                    .get("resultVar")
                    .and_then(|v| v.as_str())
                    .unwrap_or("httpResult");
                out.push_str(&format!(
                    "{pad}const fetcher = (req && req.fetch) || (input as any).fetch || ((input.context as any)?.fetch);\n\
{pad}if (!fetcher) throw new Error('Fetch implementation is missing on context');\n\
{pad}state[{}] = await fetcher({}, {{ method: {} }}).then((r: any) => r.json());\n",
                    js_string(target),
                    js_string(url),
                    js_string(method),
                ));
            }

            // ── DB ops ───────────────────────────────────
            LogicNodeType::DbCreate => {
                let model = node
                    .data
                    .get("model")
                    .and_then(|v| v.as_str())
                    .unwrap_or("record");
                let camel = to_camel_case_single(model);
                out.push_str(&format!(
                    "{pad}if (!prisma) throw new Error('Prisma client missing on req.prisma');\n\
{pad}state['created'] = await prisma.{camel}.create({{ data: payload ?? req?.body ?? {{}} }});\n",
                    camel = camel,
                ));
            }
            LogicNodeType::DbRead => {
                let model = node
                    .data
                    .get("model")
                    .and_then(|v| v.as_str())
                    .unwrap_or("record");
                let camel = to_camel_case_single(model);
                let many = node
                    .data
                    .get("findMany")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(true);
                if many {
                    out.push_str(&format!(
                        "{pad}if (!prisma) throw new Error('Prisma client missing on req.prisma');\n\
{pad}state['records'] = await prisma.{camel}.findMany();\n",
                        camel = camel,
                    ));
                } else {
                    out.push_str(&format!(
                        "{pad}if (!prisma) throw new Error('Prisma client missing on req.prisma');\n\
{pad}state['record'] = await prisma.{camel}.findUnique({{ where: {{ id: req?.params?.id }} }});\n",
                        camel = camel,
                    ));
                }
            }
            LogicNodeType::DbUpdate => {
                let model = node
                    .data
                    .get("model")
                    .and_then(|v| v.as_str())
                    .unwrap_or("record");
                let camel = to_camel_case_single(model);
                out.push_str(&format!(
                    "{pad}if (!prisma) throw new Error('Prisma client missing on req.prisma');\n\
{pad}state['updated'] = await prisma.{camel}.update({{ where: {{ id: req?.params?.id }}, data: payload ?? req?.body ?? {{}} }});\n",
                    camel = camel,
                ));
            }
            LogicNodeType::DbDelete => {
                let model = node
                    .data
                    .get("model")
                    .and_then(|v| v.as_str())
                    .unwrap_or("record");
                let camel = to_camel_case_single(model);
                out.push_str(&format!(
                    "{pad}if (!prisma) throw new Error('Prisma client missing on req.prisma');\n\
{pad}state['deleted'] = await prisma.{camel}.delete({{ where: {{ id: req?.params?.id }} }});\n",
                    camel = camel,
                ));
            }

            // ── Responses ────────────────────────────────
            LogicNodeType::Return => {
                let status = node
                    .data
                    .get("status")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(200);
                let data = data_value_to_js(
                    &node
                        .data
                        .get("data")
                        .cloned()
                        .unwrap_or(serde_json::json!({ "ok": true })),
                );
                out.push_str(&format!(
                    "{pad}const __akashaData = {data};\n\
{pad}if (res && typeof res.status === 'function' && typeof res.json === 'function') {{\n\
{pad}  res.status({status}).json(__akashaData);\n\
{pad}}}\n\
{pad}return {{ data: __akashaData }};\n",
                    data = data,
                    status = status,
                ));
            }
            LogicNodeType::ThrowError => {
                let msg = node
                    .data
                    .get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("An error occurred");
                let status = node
                    .data
                    .get("status")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(500);
                out.push_str(&format!(
                    "{pad}const __akashaMessage = {};\n\
{pad}if (res && typeof res.status === 'function' && typeof res.json === 'function') {{\n\
{pad}  res.status({status}).json({{ error: __akashaMessage }});\n\
{pad}  return {{ error: __akashaMessage }};\n\
{pad}}}\n\
{pad}throw new Error(__akashaMessage);\n",
                    js_string(msg),
                    status = status,
                ));
            }

            // ── Integration/custom ───────────────────────
            LogicNodeType::SendEmail => {
                let to = node
                    .data
                    .get("to")
                    .and_then(|v| v.as_str())
                    .unwrap_or("user@example.com");
                let subject = node
                    .data
                    .get("subject")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Hello");
                let body_text = node
                    .data
                    .get("body")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Email body");
                out.push_str(&format!(
                    "{pad}state['emailRequest'] = {{ to: {}, subject: {}, body: {} }};\n\
{pad}console.log('Send email request', state['emailRequest']);\n",
                    js_string(to),
                    js_string(subject),
                    js_string(body_text),
                ));
            }
            LogicNodeType::CustomCode => {
                let code = node
                    .data
                    .get("code")
                    .and_then(|v| v.as_str())
                    .unwrap_or("// custom code");
                for line in code.lines() {
                    out.push_str(&format!("{pad}{line}\n"));
                }
            }
        }

        for next_id in &node.next_nodes {
            Self::walk_node(next_id, nodes, out, indent, visited);
        }
        visited.pop();
    }
}

fn js_string(value: &str) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "\"\"".into())
}

fn data_value_to_js(val: &serde_json::Value) -> String {
    serde_json::to_string(val).unwrap_or_else(|_| "null".into())
}

fn to_camel_case_single(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(c) => c.to_lowercase().chain(chars).collect(),
    }
}

fn handler_name_for_flow_id(flow_id: &str) -> String {
    format!("flow_{}", sanitize_identifier(flow_id))
}

fn sanitize_identifier(input: &str) -> String {
    let mut out = String::new();
    for c in input.chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c.to_ascii_lowercase());
        } else {
            out.push('_');
        }
    }
    while out.contains("__") {
        out = out.replace("__", "_");
    }
    out = out.trim_matches('_').to_string();
    if out.is_empty() {
        out = "flow".into();
    }
    if out
        .chars()
        .next()
        .map(|c| c.is_ascii_digit())
        .unwrap_or(false)
    {
        out = format!("f_{out}");
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::generator::flow_wiring::{FlowWiring, FlowWiringResolver};
    use crate::schema::logic_flow::{ActionData, TriggerType};
    use crate::schema::{BlockType, ProjectSchema};

    #[test]
    fn compiles_flows_with_canonical_contract_signature() {
        let flow = LogicFlowSchema::new(
            "flow-1",
            "Handle Click",
            TriggerType::Manual,
            FlowContext::Frontend,
        )
        .with_node(LogicNode::new(
            "n1",
            LogicNodeType::Alert,
            ActionData::alert("Hello", "info"),
        ));

        let compiled = LogicCompiler::compile(&flow);
        assert!(compiled.code.contains("FlowInput"));
        assert!(compiled.code.contains("Promise<FlowOutput>"));
        assert!(compiled.code.contains("export async function flow_flow_1"));
    }

    #[test]
    fn compiled_code_avoids_direct_window_document_and_global_prisma_usage() {
        let flow = LogicFlowSchema::new(
            "flow-2",
            "UI + DB",
            TriggerType::Manual,
            FlowContext::Backend,
        )
        .with_node(LogicNode::new(
            "n1",
            LogicNodeType::Navigate,
            ActionData::navigate("/dashboard"),
        ))
        .with_node(LogicNode::new(
            "n2",
            LogicNodeType::DbRead,
            ActionData::db_read("User", None),
        ));

        let compiled = LogicCompiler::compile(&flow);
        assert!(!compiled.code.contains("window."));
        assert!(!compiled.code.contains("document."));
        assert!(!compiled.code.contains("await prisma."));
        assert!(compiled.code.contains("const prisma = req?.prisma;"));
    }

    #[test]
    fn compile_bundle_emits_runtime_files_and_flow_files() {
        let mut project = ProjectSchema::new("proj-1", "My App");
        let button_id = project
            .blocks
            .iter()
            .find(|b| b.block_type == BlockType::Button)
            .expect("button should exist")
            .id
            .clone();
        project.add_logic_flow(LogicFlowSchema::new(
            "flow-event",
            "Event Flow",
            TriggerType::Manual,
            FlowContext::Frontend,
        ));
        project
            .find_block_mut(&button_id)
            .expect("button exists")
            .events
            .insert("onClick".into(), "flow-event".into());

        let wiring = FlowWiringResolver::resolve(&project).expect("wiring should resolve");
        let bundle =
            LogicCompiler::compile_bundle(&project.logic_flows, FlowContext::Frontend, &wiring);

        assert!(bundle
            .files
            .iter()
            .any(|f| f.path == "src/logic/flow-contract.ts"));
        assert!(bundle
            .files
            .iter()
            .any(|f| f.path == "src/logic/flow-runner.ts"));
        assert!(bundle
            .files
            .iter()
            .any(|f| f.path == "src/logic/flow-registry.ts"));
        assert!(bundle.files.iter().any(|f| f.path == "src/logic/index.ts"));
        assert!(bundle
            .files
            .iter()
            .any(|f| f.path.contains("flow_flow_event.ts")));
    }

    #[test]
    fn backend_bundle_includes_schedule_stub_entries() {
        let mut project = ProjectSchema::new("proj-1", "My App");
        project.add_logic_flow(LogicFlowSchema::new(
            "flow-sched",
            "Schedule",
            TriggerType::Schedule {
                cron: "*/10 * * * *".into(),
            },
            FlowContext::Backend,
        ));

        let wiring = FlowWiringResolver::resolve(&project).expect("wiring should resolve");
        let bundle =
            LogicCompiler::compile_bundle(&project.logic_flows, FlowContext::Backend, &wiring);
        let schedule = bundle
            .files
            .iter()
            .find(|f| f.path == "src/logic/schedule-runner.ts")
            .expect("schedule runner should exist");
        assert!(schedule.content.contains("flow-sched"));
        assert!(schedule.content.contains("*/10 * * * *"));
    }

    #[test]
    fn empty_wiring_can_still_emit_runtime_bundle() {
        let wiring = FlowWiring::default();
        let bundle = LogicCompiler::compile_bundle(&[], FlowContext::Frontend, &wiring);
        assert_eq!(bundle.context, FlowContext::Frontend);
        assert!(bundle
            .files
            .iter()
            .any(|f| f.path == "src/logic/flow-runner.ts"));
    }
}
