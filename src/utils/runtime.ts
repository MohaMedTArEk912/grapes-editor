import { GrapesEditor } from '../types/grapes';
import { LogicFlow, StateVariable } from './schema';
import { flowToGraph, executeGraph, ExecutionContext } from './logic-graph-engine';

/**
 * Runtime Engine
 * Handles interpreting and executing logic flows within the editor canvas
 * Supports hot reload and scoped event listeners
 */
export class RuntimeEngine {
    private editor: GrapesEditor;
    private flows: LogicFlow[];
    private variables: StateVariable[];
    private updateVariable: (id: string, updates: Partial<StateVariable>) => void;
    private listeners: { element: HTMLElement; event: string; handler: EventListener }[] = [];
    private variableState: Map<string, any> = new Map();
    private _isRunning: boolean = false;
    private hotReloadEnabled: boolean = true;
    private styleObserver: MutationObserver | null = null;
    private componentObserver: MutationObserver | null = null;

    constructor(
        editor: GrapesEditor,
        flows: LogicFlow[],
        variables: StateVariable[],
        updateVariable: (id: string, updates: Partial<StateVariable>) => void
    ) {
        this.editor = editor;
        this.flows = flows;
        this.variables = variables;
        this.updateVariable = updateVariable;

        // Initialize variable state
        variables.forEach(v => {
            this.variableState.set(v.id, v.defaultValue);
        });
    }

    /**
     * Start the runtime: Attach all event listeners
     */
    start(): void {
        // Clear any existing listeners first
        this.stop();
        this._isRunning = true;

        // Cast canvas to any because type definition might be missing getWrapperEl
        const canvas = this.editor.Canvas as any;
        const iframe = canvas.getFrameEl();
        const doc = iframe?.contentDocument || iframe?.contentWindow?.document;

        if (!doc) {
            console.warn('Runtime: Cannot access canvas document.');
            return;
        }

        this.flows.forEach(flow => {
            // Find the element in the canvas
            const element = doc.querySelector(`#${flow.componentId}`);

            if (element) {
                const handler = (e: Event) => this.executeFlow(flow, e, element as HTMLElement);
                element.addEventListener(flow.event, handler);
                this.listeners.push({ element: element as HTMLElement, event: flow.event, handler });
            } else {
                console.warn(`Runtime: Element with ID ${flow.componentId} not found.`);
            }
        });

        // Setup hot reload observers if enabled
        if (this.hotReloadEnabled) {
            this.setupHotReload(doc);
        }

        console.log(`Runtime started with ${this.listeners.length} event listeners and ${this.variables.length} variables.`);
    }

    /**
     * Stop the runtime: Remove all event listeners and observers
     */
    stop(): void {
        this._isRunning = false;

        // Remove event listeners
        this.listeners.forEach(({ element, event, handler }) => {
            try {
                element.removeEventListener(event, handler);
            } catch (e) {
                // Element might have been removed
            }
        });
        this.listeners = [];

        // Disconnect observers
        if (this.styleObserver) {
            this.styleObserver.disconnect();
            this.styleObserver = null;
        }
        if (this.componentObserver) {
            this.componentObserver.disconnect();
            this.componentObserver = null;
        }

        console.log('Runtime stopped.');
    }

    /**
     * Hot reload: Update flows without full restart
     */
    hotReload(newFlows: LogicFlow[], newVariables: StateVariable[]): void {
        if (!this._isRunning) return;

        console.log('Hot reloading runtime...');

        // Update internal state
        this.flows = newFlows;
        this.variables = newVariables;

        // Update variable state (preserve existing values, add new ones)
        newVariables.forEach(v => {
            if (!this.variableState.has(v.id)) {
                this.variableState.set(v.id, v.defaultValue);
            }
        });

        // Remove variables that no longer exist
        const newVarIds = new Set(newVariables.map(v => v.id));
        for (const [id] of this.variableState) {
            if (!newVarIds.has(id)) {
                this.variableState.delete(id);
            }
        }

        // Restart with new configuration
        this.stop();
        this.start();

        console.log('Hot reload complete.');
    }

    /**
     * Enable or disable hot reload
     */
    setHotReloadEnabled(enabled: boolean): void {
        this.hotReloadEnabled = enabled;

        if (this._isRunning) {
            if (enabled) {
                const canvas = this.editor.Canvas as any;
                const iframe = canvas.getFrameEl();
                const doc = iframe?.contentDocument || iframe?.contentWindow?.document;
                if (doc) this.setupHotReload(doc);
            } else {
                if (this.styleObserver) this.styleObserver.disconnect();
                if (this.componentObserver) this.componentObserver.disconnect();
            }
        }
    }

    /**
     * Setup mutation observers for hot reload
     */
    private setupHotReload(doc: Document): void {
        // Style change observer - watches for style attribute changes
        this.styleObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    // Style changed - trigger re-render in preview
                    this.onStyleChange(mutation.target as HTMLElement);
                }
            });
        });

        // Component structure observer - watches for added/removed elements
        this.componentObserver = new MutationObserver((mutations) => {
            let needsRebind = false;

            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    // Check if any added/removed nodes have IDs we're listening to
                    const flowComponentIds = new Set(this.flows.map(f => f.componentId));

                    mutation.addedNodes.forEach((node) => {
                        if (node instanceof HTMLElement && node.id && flowComponentIds.has(node.id)) {
                            needsRebind = true;
                        }
                    });

                    mutation.removedNodes.forEach((node) => {
                        if (node instanceof HTMLElement && node.id && flowComponentIds.has(node.id)) {
                            // Remove listener for removed element
                            this.listeners = this.listeners.filter(l => l.element !== node);
                        }
                    });
                }
            });

            if (needsRebind) {
                console.log('Component structure changed, rebinding listeners...');
                this.rebindListeners(doc);
            }
        });

        // Start observing
        const body = doc.body;
        if (body) {
            this.styleObserver.observe(body, {
                attributes: true,
                attributeFilter: ['style', 'class'],
                subtree: true,
            });

            this.componentObserver.observe(body, {
                childList: true,
                subtree: true,
            });
        }
    }

    /**
     * Rebind listeners after component structure change
     */
    private rebindListeners(doc: Document): void {
        // Remove existing listeners
        this.listeners.forEach(({ element, event, handler }) => {
            try {
                element.removeEventListener(event, handler);
            } catch (e) {
                // Element might have been removed
            }
        });
        this.listeners = [];

        // Add new listeners
        this.flows.forEach(flow => {
            const element = doc.querySelector(`#${flow.componentId}`);
            if (element) {
                const handler = (e: Event) => this.executeFlow(flow, e, element as HTMLElement);
                element.addEventListener(flow.event, handler);
                this.listeners.push({ element: element as HTMLElement, event: flow.event, handler });
            }
        });
    }

    /**
     * Handle style changes (for debugging/logging)
     */
    private onStyleChange(element: HTMLElement): void {
        // Could trigger preview refresh or logging
        console.debug('Style changed on element:', element.id || element.tagName);
    }

    /**
     * Execute a specific flow using the graph engine
     */
    private async executeFlow(flow: LogicFlow, event: Event, element: HTMLElement): Promise<void> {
        console.log(`Executing flow: ${flow.name}`, flow.actions);

        const context: ExecutionContext = {
            variables: this.variableState,
            event,
            element,
            stopExecution: false,
        };

        try {
            // Convert flow to graph and execute
            const graph = flowToGraph(flow);
            await executeGraph(graph, context);
        } catch (error) {
            console.error(`Error executing flow ${flow.name}:`, error);
        }

        // Sync variable state back to context
        for (const [id, value] of this.variableState) {
            this.updateVariable(id, { defaultValue: value });
        }
    }

    /**
     * Get current variable value
     */
    getVariableValue(id: string): any {
        return this.variableState.get(id);
    }

    /**
     * Set variable value programmatically
     */
    setVariableValue(id: string, value: any): void {
        this.variableState.set(id, value);
        this.updateVariable(id, { defaultValue: value });
    }

    /**
     * Check if runtime is currently active
     */
    isActive(): boolean {
        return this._isRunning;
    }

    /**
     * Get current number of active listeners
     */
    getListenerCount(): number {
        return this.listeners.length;
    }
}
