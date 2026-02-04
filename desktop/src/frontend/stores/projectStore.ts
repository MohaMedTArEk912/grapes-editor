/**
 * Project Store - React-friendly state management
 * 
 * Manages the current project and provides reactive access to its parts for React.
 */

import { useApi, ProjectSchema, BlockSchema, PageSchema } from "../hooks/useTauri";

// Store state type
interface ProjectState {
    project: ProjectSchema | null;
    loading: boolean;
    error: string | null;
    selectedBlockId: string | null;
    selectedPageId: string | null;
    activeTab: "canvas" | "logic" | "api" | "erd";
    viewport: "desktop" | "tablet" | "mobile";
    editMode: "visual" | "code";
}

// Initial state
const initialState: ProjectState = {
    project: null,
    loading: false,
    error: null,
    selectedBlockId: null,
    selectedPageId: null,
    activeTab: "canvas",
    viewport: "desktop",
    editMode: "visual",
};

// Internal state
let state: ProjectState = { ...initialState };
let listeners: Set<() => void> = new Set();
let isDirtyValue = false;

// HTTP API client (Note: useApi is called outside component, assuming it returns static methods or handles its own context)
const api = useApi();

/**
 * Subscribe to state changes
 */
export function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/**
 * Get current state
 */
export function getSnapshot() {
    return state;
}

/**
 * Update state
 */
function updateState(updater: (prev: ProjectState) => Partial<ProjectState>) {
    state = { ...state, ...updater(state) };
    listeners.forEach(l => l());
}

/**
 * Create a new project
 */
export async function createProject(name: string): Promise<void> {
    updateState(() => ({ loading: true, error: null }));

    try {
        const project = await api.createProject(name);
        updateState(() => ({
            project,
            selectedPageId: project.pages.length > 0 ? project.pages[0].id : null
        }));
    } catch (err) {
        updateState(() => ({ error: String(err) }));
        throw err;
    } finally {
        updateState(() => ({ loading: false }));
    }
}

/**
 * Load the current project from the backend
 */
export async function loadProject(): Promise<void> {
    updateState(() => ({ loading: true, error: null }));

    try {
        const project = await api.getProject();
        updateState(() => ({
            project,
            selectedPageId: project && project.pages.length > 0 ? project.pages[0].id : null
        }));
    } catch (err) {
        updateState(() => ({ error: String(err) }));
    } finally {
        updateState(() => ({ loading: false }));
    }
}

/**
 * Import a project from JSON
 */
export async function importProject(json: string): Promise<void> {
    updateState(() => ({ loading: true, error: null }));

    try {
        const project = await api.importProjectJson(json);
        updateState(() => ({
            project,
            selectedPageId: project.pages.length > 0 ? project.pages[0].id : null
        }));
    } catch (err) {
        updateState(() => ({ error: String(err) }));
        throw err;
    } finally {
        updateState(() => ({ loading: false }));
    }
}

/**
 * Export the project to JSON
 */
export async function exportProject(): Promise<string> {
    return api.exportProjectJson();
}

/**
 * Add a new block
 */
export async function addBlock(
    blockType: string,
    name: string,
    parentId?: string
): Promise<BlockSchema> {
    const block = await api.addBlock(blockType, name, parentId);
    await loadProject();
    isDirtyValue = true;
    listeners.forEach(l => l());
    return block;
}

/**
 * Update a block property
 */
export async function updateBlockProperty(
    blockId: string,
    property: string,
    value: unknown
): Promise<void> {
    await api.updateBlockProperty(blockId, property, value);
    await loadProject();
    isDirtyValue = true;
    listeners.forEach(l => l());
}

/**
 * Update a block style
 */
export async function updateBlockStyle(
    blockId: string,
    style: string,
    value: string
): Promise<void> {
    await api.updateBlockStyle(blockId, style, value);
    await loadProject();
    isDirtyValue = true;
    listeners.forEach(l => l());
}

/**
 * Archive (soft delete) a block
 */
export async function archiveBlock(blockId: string): Promise<void> {
    await api.archiveBlock(blockId);
    await loadProject();
    isDirtyValue = true;

    if (state.selectedBlockId === blockId) {
        updateState(() => ({ selectedBlockId: null }));
    } else {
        listeners.forEach(l => l());
    }
}

/**
 * Add a new page
 */
export async function addPage(name: string, path: string): Promise<PageSchema> {
    const page = await api.addPage(name, path);
    await loadProject();
    isDirtyValue = true;
    listeners.forEach(l => l());
    return page;
}

/**
 * Add a new data model
 */
export async function addDataModel(name: string): Promise<void> {
    await api.addDataModel(name);
    await loadProject();
    isDirtyValue = true;
    listeners.forEach(l => l());
}

/**
 * Add a new API endpoint
 */
export async function addApi(
    method: string,
    path: string,
    name: string
): Promise<void> {
    await api.addApi(method, path, name);
    await loadProject();
    isDirtyValue = true;
    listeners.forEach(l => l());
}

/**
 * Generate frontend code
 */
export async function generateFrontend(): Promise<{ path: string; content: string }[]> {
    const res = await api.generateFrontend();
    return res.files;
}

/**
 * Generate backend code
 */
export async function generateBackend(): Promise<{ path: string; content: string }[]> {
    const res = await api.generateBackend();
    return res.files;
}

/**
 * Generate database schema
 */
export async function generateDatabase(): Promise<{ path: string; content: string }[]> {
    const res = await api.generateDatabase();
    return res.files;
}

/**
 * Download the project as a ZIP file
 */
export async function downloadProjectZip(): Promise<void> {
    const blob = await api.downloadZip();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.project?.name || "grapes-project"}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Select a block
 */
export function selectBlock(blockId: string | null): void {
    updateState(() => ({ selectedBlockId: blockId }));
}

/**
 * Select a page
 */
export function selectPage(pageId: string): void {
    updateState(() => ({ selectedPageId: pageId, selectedBlockId: null }));
}

/**
 * Switch the active tab
 */
export function setActiveTab(tab: "canvas" | "logic" | "api" | "erd"): void {
    updateState(() => ({ activeTab: tab }));
}

/**
 * Set the viewport size
 */
export function setViewport(viewport: "desktop" | "tablet" | "mobile"): void {
    updateState(() => ({ viewport }));
}

/**
 * Set the edit mode (visual blocks or code)
 */
export async function setEditMode(mode: "visual" | "code"): Promise<void> {
    if (mode === "visual" && state.project?.root_path) {
        try {
            await api.syncDiskToProject();
            await loadProject();
        } catch (err) {
            console.error("Failed to sync from disk:", err);
        }
    }
    updateState(() => ({ editMode: mode }));
}

/**
 * Set the project root path on disk
 */
export async function setProjectRoot(path: string): Promise<void> {
    await api.setProjectRoot(path);
    await loadProject();
}

/**
 * Force a manual sync to disk
 */
export async function syncToDisk(): Promise<void> {
    await api.syncToDisk();
}

/**
 * Get a block by ID
 */
export function getBlock(blockId: string): BlockSchema | undefined {
    return state.project?.blocks.find(b => b.id === blockId && !b.archived);
}

/**
 * Get root blocks (blocks without a parent)
 */
export function getRootBlocks(): BlockSchema[] {
    if (!state.project) return [];
    return state.project.blocks.filter(b => !b.parent_id && !b.archived);
}

/**
 * Get children of a block
 */
export function getBlockChildren(parentId: string): BlockSchema[] {
    if (!state.project) return [];
    return state.project.blocks.filter(
        b => b.parent_id === parentId && !b.archived
    );
}

/**
 * Get any page by ID
 */
export function getPage(pageId: string): PageSchema | undefined {
    return state.project?.pages.find(p => p.id === pageId && !p.archived);
}

// Export reactive state access
export const projectState = state;
export const isDirty = () => isDirtyValue;
