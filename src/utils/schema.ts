import { GrapesEditor } from '../types/grapes';

/**
 * Project Schema Interface
 * Represents a complete project state that can be saved/loaded
 */
export interface ProjectSchema {
    version: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    variables: StateVariable[]; // Global state variables
    logicFlows: LogicFlow[]; // Logic flows (event handlers)
    pages: PageSchema[];
}

export interface LogicFlow {
    id: string;
    name: string;
    componentId: string; // The ID of the component this flow belongs to
    event: 'click' | 'change' | 'load'; // The event that triggers this flow
    actions: LogicAction[];
}

export interface LogicAction {
    id: string;
    type: 'set-variable' | 'alert' | 'navigate' | 'toggle-class';
    params: Record<string, any>;
}

export interface StateVariable {
    id: string;
    name: string;
    type: 'string' | 'number' | 'boolean';
    defaultValue: string | number | boolean;
}

export interface PageSchema {
    id: string;
    name: string;
    components: any[]; // GrapesJS Component JSON
    styles: string; // GrapesJS CSS string
    assets: AssetSchema[];
}

export interface AssetSchema {
    type: string;
    src: string;
    name?: string;
}

/**
 * Export the current editor state to a JSON schema
 * @param editor - The GrapesJS editor instance
 * @param projectName - Optional name for the project
 * @returns ProjectSchema object
 */
export const exportProjectSchema = (
    editor: GrapesEditor,
    projectName: string = 'Untitled Project',
    variables: StateVariable[] = [],
    logicFlows: LogicFlow[] = []
): ProjectSchema => {
    const now = new Date().toISOString();

    // Get all assets from the Asset Manager
    const assets: AssetSchema[] = editor.AssetManager.getAll().map((asset: { get: (key: string) => string | undefined }) => ({
        type: asset.get('type') || 'image',
        src: asset.get('src') || '',
        name: asset.get('name'),
    }));

    // Create the page schema (single page for now)
    // Create the page schema (single page for now)
    const pageSchema: PageSchema = {
        id: 'main',
        name: 'Home',
        components: editor.getComponents().map((c: any) => c.toJSON()),
        styles: editor.getCss() || '',
        assets,
    };

    return {
        version: '1.0.0',
        name: projectName,
        createdAt: now,
        updatedAt: now,
        variables: variables,
        logicFlows: logicFlows,
        pages: [pageSchema],
    };
};

/**
 * Import a project schema into the editor
 * @param editor - The GrapesJS editor instance
 * @param schema - The project schema to import
 */
export const importProjectSchema = (
    editor: GrapesEditor,
    schema: ProjectSchema
): void => {
    // Validate schema version
    if (!schema.version || !schema.pages?.length) {
        throw new Error('Invalid project schema');
    }

    // Get the first page (multi-page support can be added later)
    const page = schema.pages[0];

    // Clear current content
    editor.DomComponents.clear();
    editor.CssComposer.clear();
    editor.AssetManager.getAll().reset();

    // Load assets first
    if (page.assets?.length) {
        page.assets.forEach((asset) => {
            editor.AssetManager.add({
                type: asset.type,
                src: asset.src,
                name: asset.name,
            });
        });
    }

    // Load components (HTML)
    editor.setComponents(page.components);

    // Load styles (CSS)
    if (page.styles) {
        editor.setStyle(page.styles);
    }
};

/**
 * Download the project schema as a JSON file
 * @param schema - The project schema to download
 */
export const downloadProjectSchema = (schema: ProjectSchema): void => {
    const jsonString = JSON.stringify(schema, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${schema.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * Trigger a file input to load a project JSON
 * @param editor - The GrapesJS editor instance
 * @param onSuccess - Callback on successful import
 * @param onError - Callback on error
 */
export const loadProjectFromFile = (
    editor: GrapesEditor,
    onSuccess?: (schema: ProjectSchema) => void,
    onError?: (error: Error) => void
): void => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const schema = JSON.parse(e.target?.result as string) as ProjectSchema;
                importProjectSchema(editor, schema);
                onSuccess?.(schema);
            } catch (error) {
                onError?.(error instanceof Error ? error : new Error('Failed to parse project file'));
            }
        };
        reader.onerror = () => {
            onError?.(new Error('Failed to read file'));
        };
        reader.readAsText(file);
    };

    input.click();
};
