/**
 * Logic Graph Engine
 * Converts visual logic flows to executable JavaScript
 * Supports variables, conditions, loops, and actions
 */

import { LogicFlow, StateVariable } from './schema';

/**
 * Extended action types for the graph engine
 */
export interface GraphNode {
    id: string;
    type: 'trigger' | 'action' | 'condition' | 'loop';
    data: any;
    nextNodes: string[];
    elseNodes?: string[]; // For conditions
}

export interface LogicGraph {
    id: string;
    name: string;
    nodes: GraphNode[];
    entryPoint: string;
}

/**
 * Execution context for runtime
 */
export interface ExecutionContext {
    variables: Map<string, any>;
    event?: Event;
    element?: HTMLElement;
    stopExecution?: boolean;
}

/**
 * Convert a LogicFlow to a LogicGraph structure
 */
export function flowToGraph(flow: LogicFlow): LogicGraph {
    const nodes: GraphNode[] = [];

    // Create trigger node
    const triggerNode: GraphNode = {
        id: `trigger_${flow.id}`,
        type: 'trigger',
        data: { event: flow.event, componentId: flow.componentId },
        nextNodes: flow.actions.length > 0 ? [`action_${flow.actions[0].id}`] : [],
    };
    nodes.push(triggerNode);

    // Create action nodes
    flow.actions.forEach((action, index) => {
        const nextNodes = index < flow.actions.length - 1
            ? [`action_${flow.actions[index + 1].id}`]
            : [];

        const actionNode: GraphNode = {
            id: `action_${action.id}`,
            type: 'action',
            data: { actionType: action.type, params: action.params },
            nextNodes,
        };
        nodes.push(actionNode);
    });

    return {
        id: flow.id,
        name: flow.name,
        nodes,
        entryPoint: triggerNode.id,
    };
}

/**
 * Generate JavaScript code from a LogicGraph
 */
export function graphToJavaScript(graph: LogicGraph, _variables?: StateVariable[]): string {
    const lines: string[] = [];

    // Function header
    lines.push(`// Auto-generated handler for: ${graph.name}`);
    lines.push(`function handle_${sanitizeId(graph.id)}(event, context) {`);
    lines.push(`  const { getVariable, setVariable, element } = context;`);
    lines.push('');

    // Generate code for each node following the flow
    const visited = new Set<string>();
    const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));

    function generateNodeCode(nodeId: string, indent: string = '  '): void {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);

        const node = nodeMap.get(nodeId);
        if (!node) return;

        switch (node.type) {
            case 'trigger':
                lines.push(`${indent}// Trigger: ${node.data.event}`);
                break;

            case 'action':
                lines.push(generateActionCode(node.data, indent));
                break;

            case 'condition':
                lines.push(`${indent}if (${node.data.condition}) {`);
                node.nextNodes.forEach(n => generateNodeCode(n, indent + '  '));
                if (node.elseNodes && node.elseNodes.length > 0) {
                    lines.push(`${indent}} else {`);
                    node.elseNodes.forEach(n => generateNodeCode(n, indent + '  '));
                }
                lines.push(`${indent}}`);
                return;

            case 'loop':
                lines.push(`${indent}for (let i = 0; i < ${node.data.count || 10}; i++) {`);
                node.nextNodes.forEach(n => generateNodeCode(n, indent + '  '));
                lines.push(`${indent}}`);
                return;
        }

        // Continue to next nodes
        node.nextNodes.forEach(n => generateNodeCode(n, indent));
    }

    generateNodeCode(graph.entryPoint);

    lines.push('}');
    lines.push('');

    return lines.join('\n');
}

/**
 * Generate JavaScript code for a single action
 */
function generateActionCode(data: { actionType: string; params: Record<string, any> }, indent: string): string {
    switch (data.actionType) {
        case 'alert':
            return `${indent}alert(${JSON.stringify(data.params.message || 'Alert!')});`;

        case 'navigate':
            return `${indent}window.open(${JSON.stringify(data.params.url || '')}, '_blank');`;

        case 'set-variable':
            return `${indent}setVariable(${JSON.stringify(data.params.variableId)}, ${JSON.stringify(data.params.value)});`;

        case 'toggle-class':
            return `${indent}element?.classList.toggle(${JSON.stringify(data.params.className || '')});`;

        case 'console-log':
            return `${indent}console.log(${JSON.stringify(data.params.message || '')});`;

        case 'set-attribute':
            return `${indent}element?.setAttribute(${JSON.stringify(data.params.attribute || 'data-value')}, ${JSON.stringify(data.params.value || '')});`;

        case 'remove-attribute':
            return `${indent}element?.removeAttribute(${JSON.stringify(data.params.attribute || '')});`;

        case 'add-class':
            return `${indent}element?.classList.add(${JSON.stringify(data.params.className || '')});`;

        case 'remove-class':
            return `${indent}element?.classList.remove(${JSON.stringify(data.params.className || '')});`;

        case 'set-style':
            return `${indent}if (element) element.style[${JSON.stringify(data.params.property || 'display')}] = ${JSON.stringify(data.params.value || '')};`;

        case 'set-text':
            return `${indent}if (element) element.textContent = ${JSON.stringify(data.params.text || '')};`;

        case 'set-html':
            return `${indent}if (element) element.innerHTML = ${JSON.stringify(data.params.html || '')};`;

        case 'focus':
            return `${indent}element?.focus();`;

        case 'blur':
            return `${indent}element?.blur();`;

        case 'scroll-to':
            return `${indent}element?.scrollIntoView({ behavior: 'smooth' });`;

        case 'delay':
            return `${indent}await new Promise(r => setTimeout(r, ${data.params.ms || 1000}));`;

        case 'fetch':
            return `${indent}const response = await fetch(${JSON.stringify(data.params.url || '')}, { method: ${JSON.stringify(data.params.method || 'GET')} });`;

        default:
            return `${indent}// Unknown action: ${data.actionType}`;
    }
}

/**
 * Sanitize ID for use as JavaScript identifier
 */
function sanitizeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * Generate all handlers for a list of flows
 */
export function generateAllHandlers(flows: LogicFlow[], variables: StateVariable[]): string {
    const parts: string[] = [];

    // Header
    parts.push('/**');
    parts.push(' * Auto-generated Logic Handlers');
    parts.push(` * Generated at: ${new Date().toISOString()}`);
    parts.push(' */');
    parts.push('');

    // Variable initialization
    parts.push('// Initialize state variables');
    parts.push('const _state = new Map();');
    variables.forEach(v => {
        parts.push(`_state.set(${JSON.stringify(v.id)}, ${JSON.stringify(v.defaultValue)});`);
    });
    parts.push('');

    // Helper functions
    parts.push('// Helper functions');
    parts.push('function getVariable(id) { return _state.get(id); }');
    parts.push('function setVariable(id, value) { _state.set(id, value); }');
    parts.push('');

    // Generate each handler
    flows.forEach(flow => {
        const graph = flowToGraph(flow);
        parts.push(graphToJavaScript(graph, variables));
    });

    // Event binding
    parts.push('// Event bindings');
    parts.push('document.addEventListener("DOMContentLoaded", () => {');
    flows.forEach(flow => {
        const handlerName = `handle_${sanitizeId(flow.id)}`;
        parts.push(`  const el_${sanitizeId(flow.componentId)} = document.getElementById(${JSON.stringify(flow.componentId)});`);
        parts.push(`  if (el_${sanitizeId(flow.componentId)}) {`);
        parts.push(`    el_${sanitizeId(flow.componentId)}.addEventListener(${JSON.stringify(flow.event)}, (e) => {`);
        parts.push(`      ${handlerName}(e, { getVariable, setVariable, element: el_${sanitizeId(flow.componentId)} });`);
        parts.push(`    });`);
        parts.push(`  }`);
    });
    parts.push('});');

    return parts.join('\n');
}

/**
 * Execute a graph node at runtime
 */
export async function executeNode(
    node: GraphNode,
    nodeMap: Map<string, GraphNode>,
    context: ExecutionContext
): Promise<void> {
    if (context.stopExecution) return;

    switch (node.type) {
        case 'trigger':
            // Triggers don't execute, just pass to next
            break;

        case 'action':
            await executeAction(node.data, context);
            break;

        case 'condition':
            const result = evaluateCondition(node.data.condition, context);
            const nextNodes = result ? node.nextNodes : (node.elseNodes || []);
            for (const nextId of nextNodes) {
                const nextNode = nodeMap.get(nextId);
                if (nextNode) await executeNode(nextNode, nodeMap, context);
            }
            return;

        case 'loop':
            const count = node.data.count || 10;
            for (let i = 0; i < count && !context.stopExecution; i++) {
                for (const nextId of node.nextNodes) {
                    const nextNode = nodeMap.get(nextId);
                    if (nextNode) await executeNode(nextNode, nodeMap, context);
                }
            }
            return;
    }

    // Continue to next nodes
    for (const nextId of node.nextNodes) {
        const nextNode = nodeMap.get(nextId);
        if (nextNode) await executeNode(nextNode, nodeMap, context);
    }
}

/**
 * Execute a single action at runtime
 */
async function executeAction(
    data: { actionType: string; params: Record<string, any> },
    context: ExecutionContext
): Promise<void> {
    const { variables, element } = context;

    switch (data.actionType) {
        case 'alert':
            alert(data.params.message || 'Alert!');
            break;

        case 'navigate':
            if (data.params.url) window.open(data.params.url, '_blank');
            break;

        case 'set-variable':
            if (data.params.variableId) {
                variables.set(data.params.variableId, data.params.value);
            }
            break;

        case 'toggle-class':
            element?.classList.toggle(data.params.className || '');
            break;

        case 'console-log':
            console.log(data.params.message || '');
            break;

        case 'delay':
            await new Promise(r => setTimeout(r, data.params.ms || 1000));
            break;
    }
}

/**
 * Evaluate a condition expression
 */
function evaluateCondition(condition: string, context: ExecutionContext): boolean {
    try {
        // Simple variable comparison (e.g., "variableId == 'value'")
        const varMatch = condition.match(/^(\w+)\s*(==|!=|>|<|>=|<=)\s*(.+)$/);
        if (varMatch) {
            const [, varId, op, rawValue] = varMatch;
            const varValue = context.variables.get(varId);
            const compareValue = JSON.parse(rawValue);

            switch (op) {
                case '==': return varValue == compareValue;
                case '!=': return varValue != compareValue;
                case '>': return varValue > compareValue;
                case '<': return varValue < compareValue;
                case '>=': return varValue >= compareValue;
                case '<=': return varValue <= compareValue;
            }
        }

        // Boolean variable check
        if (context.variables.has(condition)) {
            return !!context.variables.get(condition);
        }

        return false;
    } catch {
        return false;
    }
}

/**
 * Execute a complete graph
 */
export async function executeGraph(graph: LogicGraph, context: ExecutionContext): Promise<void> {
    const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
    const entryNode = nodeMap.get(graph.entryPoint);

    if (entryNode) {
        await executeNode(entryNode, nodeMap, context);
    }
}

export default {
    flowToGraph,
    graphToJavaScript,
    generateAllHandlers,
    executeGraph,
    executeNode,
};
