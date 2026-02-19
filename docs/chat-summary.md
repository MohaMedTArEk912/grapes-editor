# Canvas System Code Details

This document expands the conversation into code-level details with relevant excerpts and file links.

## UI Canvas (freeform page editor)

**Core responsibilities**
- Artboard sizing and viewport mode selection.
- Freeform drag-and-drop of root blocks.
- Visual selection and block rendering.

**Key code**
- Canvas constants, drag helpers, and block sizing:
  [desktop/src/frontend/components/Canvas/Canvas.tsx](desktop/src/frontend/components/Canvas/Canvas.tsx#L17-L120)

```tsx
const MIME_BLOCK = "application/akasha-block";
const MIME_BLOCK_FALLBACK = "text/akasha-block";
const MIME_PLAIN = "text/plain";
const BLOCK_TYPE_RE = /^[a-z][a-z0-9_-]*$/i;

const ARTBOARD_MARGIN = 12;
const BLOCK_BOUNDARY_PADDING = 12;

const ARTBOARD_SIZES: Record<string, { width: number; minHeight: number; label: string }> = {
	desktop: { width: 1280, minHeight: 900, label: "Desktop" },
	tablet: { width: 768, minHeight: 1024, label: "Tablet" },
	mobile: { width: 375, minHeight: 812, label: "Mobile" },
};

function readBlockType(dt: DataTransfer): string | null {
	const v = dt.getData(MIME_BLOCK).trim()
		|| dt.getData(MIME_BLOCK_FALLBACK).trim();
	if (v) return v;
	const plain = dt.getData(MIME_PLAIN).trim();
	return BLOCK_TYPE_RE.test(plain) ? plain.toLowerCase() : null;
}
```

- Drag handling and persist on mouse up:
  [desktop/src/frontend/components/Canvas/Canvas.tsx](desktop/src/frontend/components/Canvas/Canvas.tsx#L200-L235)

```tsx
const onMove = (e: MouseEvent) => {
	const d = dragRef.current;
	if (!d || !artboardRef.current) return;
	const dx = e.clientX - d.startX;
	const dy = e.clientY - d.startY;
	if (!d.hasMoved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
	d.hasMoved = true;

	const r = artboardRef.current.getBoundingClientRect();
	const maxLeft = Math.max(BLOCK_BOUNDARY_PADDING, r.width - d.element.offsetWidth - BLOCK_BOUNDARY_PADDING);
	const maxTop = Math.max(BLOCK_BOUNDARY_PADDING, r.height - d.element.offsetHeight - BLOCK_BOUNDARY_PADDING);
	const nextLeft = clamp(e.clientX - r.left - d.offsetX, BLOCK_BOUNDARY_PADDING, maxLeft);
	const nextTop = clamp(e.clientY - r.top - d.offsetY, BLOCK_BOUNDARY_PADDING, maxTop);
	d.element.style.left = `${nextLeft}px`;
	d.element.style.top = `${nextTop}px`;
};

const onUp = async () => {
	const d = dragRef.current;
	if (!d) return;
	dragRef.current = null;
	document.body.style.cursor = "";
	document.body.style.userSelect = "";

	if (!d.hasMoved) {
		selectBlock(d.blockId);
		return;
	}
	const fx = parseFloat(d.element.style.left) || 0;
	const fy = parseFloat(d.element.style.top) || 0;
	await updateBlockPosition(d.blockId, Math.round(fx), Math.round(fy));
};
```

- Drop to add block at position:
  [desktop/src/frontend/components/Canvas/Canvas.tsx](desktop/src/frontend/components/Canvas/Canvas.tsx#L248-L308)

```tsx
const onDrop = useCallback(async (e: React.DragEvent) => {
	e.preventDefault();
	e.stopPropagation();
	setIsDragOver(false);

	const type = readBlockType(e.dataTransfer);
	const componentId = e.dataTransfer.getData("application/akasha-component-id");

	if (!type || !artboardRef.current) {
		return;
	}

	const r = artboardRef.current.getBoundingClientRect();
	const boundedWidth = Math.min(blockWidth(type), Math.max(120, r.width - BLOCK_BOUNDARY_PADDING * 2));
	const boundedHeight = blockMinHeight(type);
	const maxX = Math.max(BLOCK_BOUNDARY_PADDING, r.width - boundedWidth - BLOCK_BOUNDARY_PADDING);
	const maxY = Math.max(BLOCK_BOUNDARY_PADDING, r.height - boundedHeight - BLOCK_BOUNDARY_PADDING);
	const x = Math.round(clamp(e.clientX - r.left, BLOCK_BOUNDARY_PADDING, maxX));
	const y = Math.round(clamp(e.clientY - r.top, BLOCK_BOUNDARY_PADDING, maxY));

	const name = `${type.charAt(0).toUpperCase() + type.slice(1)}`;
	await addBlockAtPosition(type, name, x, y, componentId || undefined);
}, []);
```

## Drag Sources (palette)

- Block palette (sets MIME types + fallback):
  [desktop/src/frontend/components/Canvas/BlockPalette.tsx](desktop/src/frontend/components/Canvas/BlockPalette.tsx#L145-L160)

```tsx
onDragStart={(e) => {
	e.dataTransfer.setData("application/akasha-block", block.type);
	e.dataTransfer.setData("text/akasha-block", block.type);
	e.dataTransfer.setData("text/plain", block.type);
	e.dataTransfer.effectAllowed = "copy";
}}
```

- Component palette (drags master component instances):
  [desktop/src/frontend/components/Visual/ComponentPalette.tsx](desktop/src/frontend/components/Visual/ComponentPalette.tsx#L62-L96)

```tsx
e.dataTransfer.setData("application/akasha-block", componentType);
if (componentId) {
	e.dataTransfer.setData("application/akasha-component-id", componentId);
}
e.dataTransfer.setData("text/plain", componentType);
e.dataTransfer.effectAllowed = "copy";
```

## Store Layer (frontend state + persistence)

- Add block at position (used by Canvas drop):
  [desktop/src/frontend/stores/projectStore.ts](desktop/src/frontend/stores/projectStore.ts#L637-L690)

```ts
export async function addBlockAtPosition(
	blockType: string,
	name: string,
	x: number,
	y: number,
	componentId?: string
): Promise<BlockSchema> {
	let parentId: string | undefined;

	if (state.selectedComponentId) {
		parentId = state.selectedComponentId;
	} else if (state.selectedPageId) {
		const page = state.project?.pages.find(p => p.id === state.selectedPageId);
		parentId = page?.root_block_id;
	}

	const block = await api.addBlock(blockType, name, parentId, undefined, componentId);
	await api.updateBlockProperty(block.id, "x", x);
	await api.updateBlockProperty(block.id, "y", y);
	await loadProject();
	isDirtyValue = true;
	return block;
}
```

- Persist drag position:
  [desktop/src/frontend/stores/projectStore.ts](desktop/src/frontend/stores/projectStore.ts#L619-L634)

```ts
export async function updateBlockPosition(
	blockId: string,
	x: number,
	y: number
): Promise<void> {
	await api.updateBlockProperty(blockId, "x", x);
	await api.updateBlockProperty(blockId, "y", y);
	await loadProject();
	isDirtyValue = true;
}
```

- Root block selection and child traversal:
  [desktop/src/frontend/stores/projectStore.ts](desktop/src/frontend/stores/projectStore.ts#L1163-L1208)

```ts
export function getRootBlocks(): BlockSchema[] {
	if (!state.project) return [];

	if (state.selectedComponentId) {
		const comp = state.project.components.find(c => c.id === state.selectedComponentId && !c.archived);
		return comp ? [comp] : [];
	}

	const activePageId = state.selectedPageId;
	if (!activePageId) return [];

	const activePage = state.project.pages.find((page) => page.id === activePageId && !page.archived);
	const selectedRootId = activePage?.root_block_id;

	if (!selectedRootId) return [];

	return state.project.blocks.filter((block) => block.id === selectedRootId && !block.archived);
}

export function getBlockChildren(parentId: string): BlockSchema[] {
	if (!state.project) return [];

	const childrenRequest = state.project.blocks.filter(
		b => b.parent_id === parentId && !b.archived
	);

	const componentChildren = state.project.components.filter(
		b => b.parent_id === parentId && !b.archived
	);

	return [...childrenRequest, ...componentChildren];
}
```

## Frontend API bridge (Tauri/HTTP)

- API methods used by the store:
  [desktop/src/frontend/hooks/useTauri.ts](desktop/src/frontend/hooks/useTauri.ts#L306-L339)

```ts
addBlock: (blockType: string, name: string, parentId?: string, pageId?: string, componentId?: string) =>
	apiCall<BlockSchema>('POST', '/api/blocks', {
		block_type: blockType,
		name,
		parent_id: parentId,
		page_id: pageId,
		component_id: componentId,
	}),

updateBlockProperty: (blockId: string, property: string, value: unknown) =>
	apiCall<BlockSchema>('PUT', `/api/blocks/${blockId}`, { property, value }),
```

## Backend routes (HTTP API)

- Add block route (parent/component/page root logic):
  [desktop/src/backend/routes/blocks.rs](desktop/src/backend/routes/blocks.rs#L40-L140)

```rust
pub async fn add_block(
	State(state): State<AppState>,
	Json(req): Json<AddBlockRequest>,
) -> Result<Json<BlockSchema>, ApiError> {
	let mut project = state.get_project().await
		.ok_or_else(|| ApiError::NotFound("No project loaded".into()))?;

	let block_type = match req.block_type.as_str() {
		"container" => BlockType::Container,
		"text" => BlockType::Text,
		"heading" => BlockType::Heading,
		"button" => BlockType::Button,
		"image" => BlockType::Image,
		"input" => BlockType::Input,
		"form" => BlockType::Form,
		"link" => BlockType::Link,
		"section" => BlockType::Section,
		"columns" => BlockType::Columns,
		"column" => BlockType::Column,
		"flex" => BlockType::Flex,
		"grid" => BlockType::Grid,
		"instance" => BlockType::Instance,
		_ => BlockType::Custom(req.block_type.clone()),
	};

	let mut block = BlockSchema::new(
		uuid::Uuid::new_v4().to_string(),
		block_type,
		&req.name,
	);

	if let Some(parent_id) = &req.parent_id {
		block.parent_id = Some(parent_id.clone());
	}

	if let Some(comp_id) = &req.component_id {
		block.component_id = Some(comp_id.clone());
	}

	let block_id = block.id.clone();
	let result = block.clone();

	let mut added_to_component = false;

	if let Some(parent_id) = &req.parent_id {
		if project.components.iter().any(|b| b.id == *parent_id) {
			project.components.push(block.clone());
			project.touch();
			added_to_component = true;
		}
	}

	if !added_to_component {
		project.add_block(block);
	}

	if let Some(parent_id) = &req.parent_id {
		if let Some(parent) = project.find_block_mut(parent_id) {
			if !parent.children.contains(&block_id) {
				parent.children.push(block_id.clone());
			}
		}
	} else if let Some(page_id) = &req.page_id {
		// attach to page root
	}

	if let Some(root) = &project.root_path {
		let engine = crate::generator::sync_engine::SyncEngine::new(root);
		if let Err(e) = engine.sync_page_to_disk_by_block(&result.id, &project) {
			log::error!("Auto-sync failed for block {}: {}", result.id, e);
		}
	}

	state.set_project(project).await;

	Ok(Json(result))
}
```

- Update block properties, styles, bindings, events:
  [desktop/src/backend/routes/blocks.rs](desktop/src/backend/routes/blocks.rs#L142-L210)

```rust
if req.property.starts_with("styles.") {
	// ... typed style values
} else if req.property.starts_with("bindings.") {
	// ... update one binding
} else if req.property == "bindings" {
	// ... replace all bindings
} else if req.property.starts_with("events.") {
	// ... update one event
} else if req.property == "events" {
	// ... replace all events
} else {
	match req.property.as_str() {
		"name" => { ... }
		"content" => { ... }
		_ => {
			block.properties.insert(req.property.clone(), req.value);
		}
	}
}
```

## Tauri commands (native API)

- Add block and update properties in Tauri mode:
  [desktop/src/lib.rs](desktop/src/lib.rs#L86-L140)

```rust
#[tauri::command]
fn add_block(
	state: State<AppState>,
	block_type: String,
	name: String,
	parent_id: Option<String>,
) -> Result<schema::BlockSchema, String> {
	let mut state_lock = state.project.lock().map_err(|_| "Lock failed")?;
	let project = state_lock.as_mut().ok_or("No project open")?;

	let block_type_enum = parse_block_type(&block_type)?;
	let block_id = uuid::Uuid::new_v4().to_string();

	let mut block = schema::BlockSchema::new(&block_id, block_type_enum, name);

	if let Some(pid) = parent_id {
		block.parent_id = Some(pid.clone());
		if let Some(parent) = project.find_block_mut(&pid) {
			parent.children.push(block_id.clone());
		}
	}

	let block_clone = block.clone();
	project.add_block(block);

	Ok(block_clone)
}
```

## Schema layer

- BlockSchema stores all properties, styles, events, bindings:
  [desktop/src/schema/block.rs](desktop/src/schema/block.rs#L6-L90)

```rust
pub struct BlockSchema {
	pub id: String,
	pub block_type: BlockType,
	pub name: String,
	pub properties: HashMap<String, Value>,
	pub children: Vec<String>,
	pub parent_id: Option<String>,
	pub styles: HashMap<String, StyleValue>,
	pub responsive_styles: HashMap<Breakpoint, HashMap<String, StyleValue>>,
	pub classes: Vec<String>,
	pub events: HashMap<String, String>,
	#[serde(default)]
	pub bindings: HashMap<String, DataBinding>,
	pub archived: bool,
	pub order: i32,
	pub physical_path: Option<String>,
	pub version_hash: Option<String>,
	pub component_id: Option<String>,
}
```

- ProjectSchema add_block and JSON serialization:
  [desktop/src/schema/project.rs](desktop/src/schema/project.rs#L384-L395)
  [desktop/src/schema/project.rs](desktop/src/schema/project.rs#L515-L524)

```rust
pub fn add_block(&mut self, block: BlockSchema) {
	self.blocks.push(block);
	self.touch();
}

pub fn to_json(&self) -> Result<String, serde_json::Error> {
	serde_json::to_string_pretty(self)
}

pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
	serde_json::from_str(json)
}
```

## Sync Engine (schema ↔ disk)

- Generate page TSX from block tree:
  [desktop/src/generator/sync_engine.rs](desktop/src/generator/sync_engine.rs#L470-L560)

```rust
pub fn sync_page_to_disk(&self, page_id: &str, project: &ProjectSchema) -> std::io::Result<()> {
	let page = project.find_page(page_id).ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "Page not found"))?;

	let page_dir = self.pages_dir();
	fs::create_dir_all(&page_dir)?;

	let mut page_content = String::new();
	page_content.push_str("import React from 'react';\n");

	let mut used_components = std::collections::HashSet::new();
	if let Some(root_id) = &page.root_block_id {
		self.collect_used_components(root_id, project, &mut used_components);
	}

	// ... imports, JSX, write file
}
```

- Emit block content with markers:
  [desktop/src/generator/sync_engine.rs](desktop/src/generator/sync_engine.rs#L600-L700)

```rust
content.push_str(&format!("{indent_str}/* @akasha-block id=\"{}\" */\n", block.id));

if is_container {
	content.push_str(&format!("{indent_str}<{}{}>\n", comp_name, props));
	// children...
	content.push_str(&format!("{indent_str}</{}>\n", comp_name));
} else {
	content.push_str(&format!("{indent_str}<{}{} />\n", comp_name, props));
}

content.push_str(&format!("{indent_str}/* @akasha-block-end */\n"));
```

- Sync page by block and reverse sync from disk:
  [desktop/src/generator/sync_engine.rs](desktop/src/generator/sync_engine.rs#L739-L820)

```rust
pub fn sync_page_to_disk_by_block(&self, block_id: &str, project: &ProjectSchema) -> std::io::Result<()> {
	for page in &project.pages {
		if page.archived { continue; }
		if let Some(root_id) = &page.root_block_id {
			if self.is_block_in_tree(block_id, root_id, project) {
				return self.sync_page_to_disk(&page.id, project);
			}
		}
	}
	Ok(())
}

pub fn sync_disk_to_project(&self, project: &mut ProjectSchema) -> std::io::Result<()> {
	let mut updates = Vec::new();
	for page in &project.pages {
		if page.archived { continue; }
		// read TSX, parse blocks
	}
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
```

## Logic flows (schema + compiler)

- Flow schema (trigger types + nodes):
  [desktop/src/schema/logic_flow.rs](desktop/src/schema/logic_flow.rs#L9-L116)

```rust
pub struct LogicFlowSchema {
	pub id: String,
	pub name: String,
	pub description: Option<String>,
	pub trigger: TriggerType,
	pub nodes: Vec<LogicNode>,
	pub entry_node_id: Option<String>,
	pub context: FlowContext,
	pub archived: bool,
}

pub enum TriggerType {
	Event { component_id: String, event: String },
	Api { api_id: String },
	Mount { component_id: String },
	Schedule { cron: String },
	Manual,
}
```

- Logic compiler (graph → TS functions):
  [desktop/src/generator/logic_compiler.rs](desktop/src/generator/logic_compiler.rs#L11-L90)

```rust
pub fn compile(flow: &LogicFlowSchema) -> CompiledFlow {
	let node_map: HashMap<&str, &LogicNode> = flow.nodes.iter()
		.map(|n| (n.id.as_str(), n))
		.collect();

	let fn_name = to_camel_case(&flow.name);
	let mut body = String::new();

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

	CompiledFlow { flow_id: flow.id.clone(), path, code, context: flow.context.clone() }
}
```

## Event binding UI (Inspector)

- Events panel binds block events to logic flows:
  [desktop/src/frontend/components/Visual/Inspector.tsx](desktop/src/frontend/components/Visual/Inspector.tsx#L400-L470)

```tsx
const BLOCK_EVENTS = ["onClick", "onDoubleClick", "onChange", "onSubmit", "onFocus", "onBlur", "onMouseEnter", "onMouseLeave", "onKeyDown"];

const handleAddEvent = async (eventName: string) => {
	if (!eventName) return;
	await updateBlockEvent(block.id, eventName, "");
};

const handleEventFlowChange = async (eventName: string, flowId: string) => {
	await updateBlockEvent(block.id, eventName, flowId || "");
};
```

## Code generation: where logic flows are included

- Backend generator includes compiled flows in output:
  [desktop/src/backend/routes/generate.rs](desktop/src/backend/routes/generate.rs#L48-L92)

```rust
let compiled = crate::generator::LogicCompiler::compile_all(&project.logic_flows);
for cf in compiled {
	files.push(GeneratedFile {
		path: cf.path,
		content: cf.code,
	});
}
```

- ZIP generator also includes compiled flows by context:
  [desktop/src/backend/routes/generate.rs](desktop/src/backend/routes/generate.rs#L108-L175)

## Wiring gaps (current state)

**Frontend generator**
- Generates JSX without using `block.events`.
- No imports for compiled flow functions.

Relevant code: [desktop/src/generator/frontend.rs](desktop/src/generator/frontend.rs#L150-L250)

```rust
let (tag, self_closing) = match &block.block_type {
	BlockType::Container | BlockType::Section => ("div", false),
	BlockType::Heading => ("h1", false),
	BlockType::Paragraph | BlockType::Text => ("p", false),
	BlockType::Button => ("button", false),
	// ...
};

out.push_str(&format!("{pad}<{final_tag} className=\"{classes}\">"));
```

**Backend generator**
- Controllers call CRUD services or return stubs.
- `api.logic_flow_id` is not used.

Relevant code: [desktop/src/generator/backend.rs](desktop/src/generator/backend.rs#L520-L650)

```rust
match (&api.method, model) {
	(HttpMethod::Get, Some(m)) if !has_id => {
		// ... service.findAll
	}
	(HttpMethod::Post, Some(m)) => {
		// ... service.create
	}
	_ => {
		// fallback stub
	}
}
```

## Suggested wiring points (if you want to implement)

- **Frontend:** extend `generate_block_jsx` to add `onClick={flowHandler}` and import flow handlers in `generate_page` and `generate_component`.
- **Backend:** in `gen_controller`, if `api.logic_flow_id` is set, call the compiled flow function instead of CRUD service calls.

If you want, I can implement these wiring changes directly or provide a full patch plan.
