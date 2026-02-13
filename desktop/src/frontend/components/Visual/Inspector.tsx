/**
 * Inspector Panel - Visual Mode Property Editor
 * 
 * Shows properties, styles, and events for the selected component.
 * When no component is selected, shows Layers, Pages, and Assets tabs with full CRUD.
 */

import React, { useState, useEffect } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import {
    getBlock,
    getRootBlocks,
    getBlockChildren,
    updateBlockProperty,
    updateBlockStyle,
    updateBlockBinding,
    updateBlockEvent,
    moveBlock,
    archivePage,
    archiveBlock,
    listDirectory,
    createFile,
    deleteFile,
    selectBlock
} from "../../stores/projectStore";
import { useToast } from "../../context/ToastContext";
import ConfirmModal from "../Modals/ConfirmModal";

type InspectorTab = "properties" | "styles" | "events";
type GlobalTab = "layers" | "assets";

const Inspector: React.FC = () => {
    const { selectedBlockId, project } = useProjectStore();

    const [activeTab, setActiveTab] = useState<InspectorTab>("properties");
    const [globalTab, setGlobalTab] = useState<GlobalTab>("layers");
    const toast = useToast();

    // Modal States
    const [pendingDeleteBlockId, setPendingDeleteBlockId] = useState<string | null>(null);
    const [pendingDeletePageId, setPendingDeletePageId] = useState<string | null>(null);
    const [pendingDeleteAssetPath, setPendingDeleteAssetPath] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const selectedBlock = selectedBlockId ? getBlock(selectedBlockId) : null;

    const handlePropertyChange = async (property: string, value: unknown) => {
        if (selectedBlock) {
            await updateBlockProperty(selectedBlock.id, property, value);
        }
    };

    const handleStyleChange = async (style: string, value: string) => {
        if (selectedBlock) {
            await updateBlockStyle(selectedBlock.id, style, value);
        }
    };

    // --- Modal Handlers ---

    const confirmDeleteBlock = async () => {
        if (!pendingDeleteBlockId) return;
        setIsProcessing(true);
        try {
            await archiveBlock(pendingDeleteBlockId);
            toast.success("Component deleted");
            setPendingDeleteBlockId(null);
        } catch (err) {
            toast.error("Failed to delete component");
        } finally {
            setIsProcessing(false);
        }
    };

    const confirmDeletePage = async () => {
        if (!pendingDeletePageId) return;
        setIsProcessing(true);
        try {
            await archivePage(pendingDeletePageId);
            toast.success("Page deleted");
            setPendingDeletePageId(null);
        } catch (err) {
            toast.error("Failed to delete page");
        } finally {
            setIsProcessing(false);
        }
    };

    const confirmDeleteAsset = async () => {
        if (!pendingDeleteAssetPath) return;
        setIsProcessing(true);
        try {
            await deleteFile(pendingDeleteAssetPath);
            setPendingDeleteAssetPath(null);
            toast.success("Asset deleted");
        } catch (err) {
            toast.error("Delete failed");
        } finally {
            setIsProcessing(false);
        }
    };

    // Helper names for modals
    const pendingBlockName = project?.blocks.find(b => b.id === pendingDeleteBlockId)?.name || "this component";
    const pendingPageName = project?.pages.find(p => p.id === pendingDeletePageId)?.name || "this page";
    const pendingAssetName = pendingDeleteAssetPath?.split("/").pop() || "this file";

    return (
        <div className="w-72 bg-[var(--ide-bg-sidebar)] border-l border-[var(--ide-border)] flex flex-col h-full overflow-hidden animate-slide-up">
            {/* ── Header ── */}
            <div className="h-12 px-4 flex items-center justify-between border-b border-[var(--ide-border)] bg-[var(--ide-bg-elevated)]">
                <span className="text-[10px] text-[var(--ide-text-secondary)] font-bold uppercase tracking-[0.2em]">
                    {selectedBlock ? "Selection" : "Inspector"}
                </span>
                {selectedBlock && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                        <div className="w-1 h-1 rounded-full bg-indigo-400" />
                        <span className="text-[9px] text-indigo-500 font-bold uppercase tracking-tighter">Active</span>
                    </div>
                )}
            </div>

            {/* ── Tabs ── */}
            <div className="flex border-b border-[var(--ide-border)] bg-[var(--ide-bg-elevated)]">
                {(selectedBlock ? ["properties", "styles", "events"] : ["layers", "assets"]).map((tab) => {
                    const isActive = selectedBlock ? activeTab === tab : globalTab === tab;
                    return (
                        <button
                            key={tab}
                            onClick={() => selectedBlock ? setActiveTab(tab as InspectorTab) : setGlobalTab(tab as GlobalTab)}
                            className={`flex-1 px-2 py-3 text-[10px] font-bold uppercase tracking-widest transition-all relative ${isActive ? "text-[var(--ide-text)]" : "text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-bg-panel)]"
                                }`}
                        >
                            {tab}
                            {isActive && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ── Content ── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {!selectedBlock ? (
                    <>
                        {globalTab === "layers" && <LayersPanel onDeleteRequest={setPendingDeleteBlockId} />}

                        {globalTab === "assets" && <AssetsPanel onDeleteRequest={setPendingDeleteAssetPath} />}
                    </>
                ) : (
                    <div className="animate-fade-in">
                        {/* Selected Component Brief */}
                        <div className="p-4 bg-[var(--ide-bg-elevated)] border-b border-[var(--ide-border)]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-inner">
                                    <span className="text-xl">📦</span>
                                </div>
                                <div className="min-w-0">
                                    <div className="text-xs text-[var(--ide-text)] font-bold truncate tracking-tight">{selectedBlock.name}</div>
                                    <div className="text-[9px] text-[var(--ide-text-secondary)] font-bold uppercase tracking-widest mt-0.5 italic">{selectedBlock.block_type}</div>
                                </div>
                            </div>
                        </div>

                        {activeTab === "properties" && (
                            <PropertiesPanel block={selectedBlock} onChange={handlePropertyChange} />
                        )}
                        {activeTab === "styles" && (
                            <StylesPanel block={selectedBlock} onChange={handleStyleChange} />
                        )}
                        {activeTab === "events" && (
                            <EventsPanel block={selectedBlock} />
                        )}
                    </div>
                )}
            </div>

            {/* ── CENTRALIZED MODALS (Outside containers) ── */}

            <ConfirmModal
                isOpen={pendingDeleteBlockId !== null}
                title="Delete Component"
                message={`Delete "${pendingBlockName}"? This action cannot be undone.`}
                confirmText="Delete"
                variant="danger"
                isLoading={isProcessing}
                onConfirm={confirmDeleteBlock}
                onCancel={() => !isProcessing && setPendingDeleteBlockId(null)}
            />

            <ConfirmModal
                isOpen={pendingDeletePageId !== null}
                title="Delete Page"
                message={`Delete "${pendingPageName}" permanently? This action cannot be undone.`}
                confirmText="Delete"
                variant="danger"
                isLoading={isProcessing}
                onConfirm={confirmDeletePage}
                onCancel={() => !isProcessing && setPendingDeletePageId(null)}
            />

            <ConfirmModal
                isOpen={pendingDeleteAssetPath !== null}
                title="Delete Asset"
                message={`Delete "${pendingAssetName}" permanently? This action cannot be undone.`}
                confirmText="Delete"
                variant="danger"
                isLoading={isProcessing}
                onConfirm={confirmDeleteAsset}
                onCancel={() => !isProcessing && setPendingDeleteAssetPath(null)}
            />
        </div>
    );
};

// Layers Panel
const LayersPanel: React.FC<{ onDeleteRequest: (id: string) => void }> = ({ onDeleteRequest }) => {
    const { selectedBlockId } = useProjectStore();
    const rootBlocks = getRootBlocks();
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<{ parentId: string; index: number } | null>(null);

    const toggleExpanded = (id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    useEffect(() => {
        setExpandedIds((prev) => {
            if (prev.size > 0) return prev;
            return new Set(rootBlocks.map((block) => block.id));
        });
    }, [rootBlocks]);

    const isDescendant = (ancestorId: string, nodeId: string): boolean => {
        const children = getBlockChildren(ancestorId);
        for (const child of children) {
            if (child.id === nodeId) return true;
            if (isDescendant(child.id, nodeId)) return true;
        }
        return false;
    };

    const canDrop = (targetParentId: string, sourceId: string): boolean => {
        if (targetParentId === sourceId) return false;
        return !isDescendant(sourceId, targetParentId);
    };

    const handleDrop = async () => {
        if (!draggingId || !dropTarget) {
            setDraggingId(null);
            setDropTarget(null);
            return;
        }
        if (!canDrop(dropTarget.parentId, draggingId)) {
            setDraggingId(null);
            setDropTarget(null);
            return;
        }

        try {
            await moveBlock(draggingId, dropTarget.parentId, dropTarget.index);
            selectBlock(draggingId);
        } catch (error) {
            console.error("Failed to reorder layer:", error);
        } finally {
            setDraggingId(null);
            setDropTarget(null);
        }
    };

    return (
        <div className="p-3">
            <div className="mb-4">
                <div className="text-xs text-[var(--ide-text-secondary)] flex items-center gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    <span>Layers</span>
                </div>
            </div>

            {rootBlocks.length === 0 ? (
                <div className="text-center py-10 px-4 bg-[var(--ide-bg-sidebar)]/30 rounded-2xl border border-dashed border-[var(--ide-border)]">
                    <p className="text-[10px] text-[var(--ide-text-muted)] uppercase tracking-widest font-bold">Empty Canvas</p>
                    <p className="text-[9px] text-[var(--ide-text-muted)] mt-1">Drag components from the palette</p>
                </div>
            ) : (
                <div className="space-y-1">
                    {rootBlocks.map((block) => (
                        <LayerTreeNode
                            key={block.id}
                            blockId={block.id}
                            depth={0}
                            parentId={null}
                            indexInParent={0}
                            selectedBlockId={selectedBlockId}
                            expandedIds={expandedIds}
                            toggleExpanded={toggleExpanded}
                            onDeleteRequest={onDeleteRequest}
                            draggingId={draggingId}
                            setDraggingId={setDraggingId}
                            dropTarget={dropTarget}
                            setDropTarget={setDropTarget}
                            handleDrop={handleDrop}
                            canDrop={canDrop}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

interface LayerTreeNodeProps {
    blockId: string;
    depth: number;
    parentId: string | null;
    indexInParent: number;
    selectedBlockId: string | null;
    expandedIds: Set<string>;
    toggleExpanded: (id: string) => void;
    onDeleteRequest: (id: string) => void;
    draggingId: string | null;
    setDraggingId: (id: string | null) => void;
    dropTarget: { parentId: string; index: number } | null;
    setDropTarget: (target: { parentId: string; index: number } | null) => void;
    handleDrop: () => Promise<void>;
    canDrop: (targetParentId: string, sourceId: string) => boolean;
}

const LayerTreeNode: React.FC<LayerTreeNodeProps> = ({
    blockId,
    depth,
    parentId,
    indexInParent,
    selectedBlockId,
    expandedIds,
    toggleExpanded,
    onDeleteRequest,
    draggingId,
    setDraggingId,
    dropTarget,
    setDropTarget,
    handleDrop,
    canDrop,
}) => {
    const block = getBlock(blockId);
    if (!block) return null;

    const children = getBlockChildren(block.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(block.id);
    const isSelected = selectedBlockId === block.id;

    const onRowDragOver = (e: React.DragEvent) => {
        if (!parentId || !draggingId) return;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const insertAfter = e.clientY > rect.top + rect.height / 2;
        const targetIndex = insertAfter ? indexInParent + 1 : indexInParent;
        if (!canDrop(parentId, draggingId)) return;
        e.preventDefault();
        e.stopPropagation();
        setDropTarget({ parentId, index: targetIndex });
    };

    const onContainerDragOver = (e: React.DragEvent) => {
        if (!draggingId || !canDrop(block.id, draggingId)) return;
        e.preventDefault();
        e.stopPropagation();
        setDropTarget({ parentId: block.id, index: children.length });
    };

    return (
        <div className="space-y-1">
            {parentId && dropTarget?.parentId === parentId && dropTarget.index === indexInParent && (
                <div className="h-0.5 rounded-full bg-indigo-500/90 mx-2" />
            )}
            <div
                draggable
                onDragStart={(e) => {
                    e.stopPropagation();
                    setDraggingId(block.id);
                }}
                onDragEnd={() => {
                    setDraggingId(null);
                    setDropTarget(null);
                }}
                onDragOver={onRowDragOver}
                onDrop={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await handleDrop();
                }}
                onClick={() => selectBlock(block.id)}
                className={`group px-3 py-2 rounded-xl border transition-all flex items-center gap-2 cursor-pointer ${isSelected
                    ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30 shadow-sm"
                    : "text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] bg-[var(--ide-bg-elevated)] border-[var(--ide-border)] hover:border-[var(--ide-border-strong)]"
                    } ${draggingId === block.id ? "opacity-60" : ""}`}
                style={{ marginLeft: `${depth * 12}px` }}
            >
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (hasChildren) toggleExpanded(block.id);
                    }}
                    className={`w-4 h-4 shrink-0 flex items-center justify-center rounded ${hasChildren ? "text-[var(--ide-text-muted)] hover:bg-[var(--ide-bg-panel)]" : "opacity-0 pointer-events-none"}`}
                >
                    <svg
                        className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                </button>

                <svg className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-indigo-400" : "text-[var(--ide-text-muted)]"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>

                <span className="truncate flex-1 font-bold text-[11px] tracking-tight">{block.name}</span>

                <button
                    onClick={(e) => { e.stopPropagation(); onDeleteRequest(block.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 rounded-lg text-red-500/60 hover:text-red-500 transition-all"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>

            {hasChildren && isExpanded && (
                <div onDragOver={onContainerDragOver} onDrop={async (e) => { e.preventDefault(); e.stopPropagation(); await handleDrop(); }}>
                    {children.map((child, childIndex) => (
                        <LayerTreeNode
                            key={child.id}
                            blockId={child.id}
                            depth={depth + 1}
                            parentId={block.id}
                            indexInParent={childIndex}
                            selectedBlockId={selectedBlockId}
                            expandedIds={expandedIds}
                            toggleExpanded={toggleExpanded}
                            onDeleteRequest={onDeleteRequest}
                            draggingId={draggingId}
                            setDraggingId={setDraggingId}
                            dropTarget={dropTarget}
                            setDropTarget={setDropTarget}
                            handleDrop={handleDrop}
                            canDrop={canDrop}
                        />
                    ))}
                    {dropTarget?.parentId === block.id && dropTarget.index === children.length && (
                        <div className="h-0.5 rounded-full bg-indigo-500/90 ml-6 mr-2" />
                    )}
                </div>
            )}
        </div>
    );
};

// Assets Panel
const AssetsPanel: React.FC<{ onDeleteRequest: (path: string) => void }> = ({ onDeleteRequest }) => {
    const { project } = useProjectStore();
    const [assets, setAssets] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const toast = useToast();

    const assetsPath = project?.root_path ? `${project.root_path}/client/public/assets` : null;

    const loadAssets = async () => {
        if (!assetsPath) return;
        setLoading(true);
        try {
            const res = await listDirectory(assetsPath);
            setAssets(res.entries.filter(e => !e.is_directory));
        } catch (err) {
            setAssets([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAssets();
    }, [assetsPath]);

    const handleAddDemo = async () => {
        if (!assetsPath) return;
        try {
            const name = `asset_${Date.now()}.png`;
            await createFile(`${assetsPath}/${name}`, "");
            loadAssets();
            toast.success("Demo asset registered");
        } catch (err) {
            toast.error("Failed to add asset");
        }
    };

    return (
        <div className="p-3">
            <div className="mb-4 flex items-center justify-between">
                <div className="text-xs text-[var(--ide-text-secondary)] flex items-center gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Assets</span>
                </div>
                <button
                    onClick={handleAddDemo}
                    className="p-1.5 hover:bg-indigo-500/10 rounded-lg text-indigo-400 group transition-colors"
                >
                    <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                    </svg>
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12">
                    <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto" />
                </div>
            ) : assets.length === 0 ? (
                <div className="text-center py-12 px-4 bg-[var(--ide-bg-sidebar)]/30 rounded-2xl border border-dashed border-[var(--ide-border)]">
                    <p className="text-[10px] text-[var(--ide-text-muted)] uppercase tracking-widest font-bold">No Assets</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-2">
                    {assets.map((asset) => (
                        <div key={asset.path} className="group relative aspect-square bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded-xl overflow-hidden hover:border-indigo-500/50 transition-all">
                            <div className="w-full h-full flex items-center justify-center text-indigo-400/20">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                <div className="text-[8px] text-white truncate">{asset.name}</div>
                            </div>
                            <button
                                onClick={() => onDeleteRequest(asset.path)}
                                className="absolute top-1 right-1 p-1 bg-red-500/80 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Properties Panel
const PropertiesPanel: React.FC<{ block: any; onChange: (prop: string, value: unknown) => void }> = ({ block, onChange }) => {
    return (
        <div className="p-4 space-y-4">
            {/* Text Property */}
            {["text", "paragraph", "heading", "button"].includes(block.block_type) && (
                <div>
                    <label className="block text-[10px] text-[var(--ide-text-secondary)] font-bold uppercase tracking-wider mb-1.5">Text Content</label>
                    <input
                        type="text"
                        value={(block.properties.text as string) || ""}
                        onChange={(e) => onChange("text", e.target.value)}
                        className="w-full bg-[var(--ide-bg-panel)] text-[var(--ide-text)] text-xs px-3 py-2 rounded-xl border border-[var(--ide-border)] focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
                    />
                </div>
            )}
        </div>
    );
};

// Styles Panel
const StylesPanel: React.FC<{ block: any; onChange: (style: string, value: string) => void }> = ({ block, onChange }) => {
    return (
        <div className="p-4 space-y-5">
            {/* Background Color */}
            <div className="space-y-2">
                <label className="block text-[10px] text-[var(--ide-text-secondary)] font-bold uppercase tracking-wider">Appearance</label>
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-xl border-2 border-[var(--ide-border)] relative overflow-hidden group cursor-pointer"
                        style={{ backgroundColor: (block.styles.backgroundColor as string) || "transparent" }}
                    >
                        <input
                            type="color"
                            value={(block.styles.backgroundColor as string) || "#ffffff"}
                            onChange={(e) => onChange("backgroundColor", e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                    </div>
                    <div className="flex-1">
                        <div className="text-[10px] text-[var(--ide-text-muted)] font-mono uppercase">Background</div>
                        <div className="text-xs font-bold text-[var(--ide-text)] mt-0.5">{(block.styles.backgroundColor as string) || "Transparent"}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Events & Bindings Panel
const BLOCK_EVENTS = ["onClick", "onDoubleClick", "onChange", "onSubmit", "onFocus", "onBlur", "onMouseEnter", "onMouseLeave", "onKeyDown"];
const BINDING_TYPES = ["variable", "api", "state", "prop"];

const EventsPanel: React.FC<{ block: any }> = ({ block }) => {
    const { project } = useProjectStore();
    const toast = useToast();
    const [newEvent, setNewEvent] = useState("");
    const [newBindingProp, setNewBindingProp] = useState("");

    const logicFlows = project?.logic_flows.filter(lf => !lf.archived) || [];
    const variables = project?.variables.filter(v => !v.archived) || [];
    const events: Record<string, string> = block.events || {};
    const bindings: Record<string, { type: string; value: unknown }> = block.bindings || {};

    const usedEvents = Object.keys(events);
    const availableEvents = BLOCK_EVENTS.filter(e => !usedEvents.includes(e));

    const handleAddEvent = async (eventName: string) => {
        if (!eventName) return;
        try {
            await updateBlockEvent(block.id, eventName, "");
            setNewEvent("");
        } catch (err) { toast.error(`Failed: ${err}`); }
    };

    const handleRemoveEvent = async (eventName: string) => {
        try {
            await updateBlockEvent(block.id, eventName, null);
        } catch (err) { toast.error(`Failed: ${err}`); }
    };

    const handleEventFlowChange = async (eventName: string, flowId: string) => {
        try {
            await updateBlockEvent(block.id, eventName, flowId || "");
        } catch (err) { toast.error(`Failed: ${err}`); }
    };

    const handleAddBinding = async (propName: string) => {
        if (!propName) return;
        try {
            await updateBlockBinding(block.id, propName, { type: "variable", value: "" });
            setNewBindingProp("");
        } catch (err) { toast.error(`Failed: ${err}`); }
    };

    const handleRemoveBinding = async (propName: string) => {
        try {
            await updateBlockBinding(block.id, propName, null);
        } catch (err) { toast.error(`Failed: ${err}`); }
    };

    const handleBindingChange = async (propName: string, type: string, value: unknown) => {
        try {
            await updateBlockBinding(block.id, propName, { type, value });
        } catch (err) { toast.error(`Failed: ${err}`); }
    };

    const blockProps = Object.keys(block.properties || {});
    const unboundProps = blockProps.filter(p => !bindings[p]);

    return (
        <div className="p-4 space-y-6">
            {/* ── Event Handlers ── */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--ide-text-secondary)]">Event Handlers</h3>
                </div>
                {usedEvents.length === 0 && (
                    <p className="text-[10px] text-[var(--ide-text-muted)] italic mb-2">No event handlers configured</p>
                )}
                {usedEvents.map(eventName => (
                    <div key={eventName} className="mb-2 p-2 bg-[var(--ide-bg-elevated)] rounded border border-[var(--ide-border)] group">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-mono text-indigo-400">{eventName}</span>
                            <button onClick={() => handleRemoveEvent(eventName)}
                                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs transition-opacity">
                                &times;
                            </button>
                        </div>
                        <select
                            value={events[eventName] || ""}
                            onChange={(e) => handleEventFlowChange(eventName, e.target.value)}
                            className="w-full px-2 py-1 text-xs bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded text-[var(--ide-text)] focus:outline-none focus:border-[var(--ide-primary)]"
                        >
                            <option value="">— Select logic flow —</option>
                            {logicFlows.map(lf => (
                                <option key={lf.id} value={lf.id}>{lf.name}</option>
                            ))}
                        </select>
                    </div>
                ))}
                {availableEvents.length > 0 && (
                    <div className="flex gap-1 mt-2">
                        <select value={newEvent} onChange={(e) => setNewEvent(e.target.value)}
                            className="flex-1 px-2 py-1 text-xs bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded text-[var(--ide-text-muted)] focus:outline-none">
                            <option value="">+ Add event...</option>
                            {availableEvents.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                        {newEvent && (
                            <button onClick={() => handleAddEvent(newEvent)}
                                className="px-2 py-1 text-xs bg-[var(--ide-primary)] text-white rounded hover:bg-[var(--ide-primary-hover)]">
                                Add
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ── Data Bindings ── */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--ide-text-secondary)]">Data Bindings</h3>
                </div>
                {Object.keys(bindings).length === 0 && (
                    <p className="text-[10px] text-[var(--ide-text-muted)] italic mb-2">No data bindings configured</p>
                )}
                {Object.entries(bindings).map(([propName, binding]) => (
                    <div key={propName} className="mb-2 p-2 bg-[var(--ide-bg-elevated)] rounded border border-[var(--ide-border)] group">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-mono text-green-400">{propName}</span>
                            <button onClick={() => handleRemoveBinding(propName)}
                                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs transition-opacity">
                                &times;
                            </button>
                        </div>
                        <div className="flex gap-1">
                            <select
                                value={binding.type}
                                onChange={(e) => handleBindingChange(propName, e.target.value, binding.value)}
                                className="w-20 px-1 py-1 text-[10px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded text-[var(--ide-text-muted)] focus:outline-none"
                            >
                                {BINDING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            {binding.type === "variable" ? (
                                <select
                                    value={String(binding.value || "")}
                                    onChange={(e) => handleBindingChange(propName, binding.type, e.target.value)}
                                    className="flex-1 px-2 py-1 text-xs bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded text-[var(--ide-text)] focus:outline-none"
                                >
                                    <option value="">— Select variable —</option>
                                    {variables.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                </select>
                            ) : (
                                <input
                                    value={String(binding.value || "")}
                                    onChange={(e) => handleBindingChange(propName, binding.type, e.target.value)}
                                    placeholder="value / path"
                                    className="flex-1 px-2 py-1 text-xs bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded text-[var(--ide-text)] focus:outline-none focus:border-[var(--ide-primary)]"
                                />
                            )}
                        </div>
                    </div>
                ))}
                {unboundProps.length > 0 && (
                    <div className="flex gap-1 mt-2">
                        <select value={newBindingProp} onChange={(e) => setNewBindingProp(e.target.value)}
                            className="flex-1 px-2 py-1 text-xs bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded text-[var(--ide-text-muted)] focus:outline-none">
                            <option value="">+ Bind property...</option>
                            {unboundProps.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        {newBindingProp && (
                            <button onClick={() => handleAddBinding(newBindingProp)}
                                className="px-2 py-1 text-xs bg-[var(--ide-primary)] text-white rounded hover:bg-[var(--ide-primary-hover)]">
                                Bind
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Inspector;
