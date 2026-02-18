/**
 * Canvas – GrapesJS-style visual page editor
 *
 * All blocks live in normal document flow (no absolute positioning).
 * Drag from the ComponentPalette to insert; drag existing blocks to reorder.
 * Click to select; double-click text to edit inline.
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
    selectBlock,
    getBlockChildren,
    getRootBlocks,
    addBlockAtPosition,
    moveBlock,
    setViewport,
    closeComponentEditor,
    updateBlockProperty,
} from "../../../stores/projectStore";
import { useProjectStore } from "../../../hooks/useProjectStore";
import { BlockSchema } from "../../../hooks/useTauri";
import { useDragDrop, DragPayload } from "../../../context/DragDropContext";

/* ═══════════════════  Constants  ═══════════════════ */

const MIME = "application/akasha-block";
const MIME_FALLBACK = "text/akasha-block";
const MIME_MOVE = "application/akasha-move"; // existing block reorder
const MIME_COMPONENT = "application/akasha-component-id";
const BLOCK_RE = /^[a-z][a-z0-9_-]*$/i;

const CONTAINER_TYPES = new Set([
    "container", "section", "form", "card", "columns", "column", "flex", "grid",
]);

const ARTBOARD_SIZES: Record<string, { w: number; h: number; label: string }> = {
    desktop: { w: 1440, h: 900, label: "Desktop" },
    tablet: { w: 768, h: 1024, label: "Tablet" },
    mobile: { w: 375, h: 812, label: "Mobile" },
};

/* ═══════════════════  Types  ═══════════════════════ */

/** Where a new / moved block will land. */
interface InsertionPoint {
    parentId: string | null;
    index: number;
}

/* ═══════════════════  Helpers  ═════════════════════ */

// Global drag data storage for WebView compatibility
(window as any).__akashaDragData = null;

function readBlockType(dt: DataTransfer): string | null {
    const v = dt.getData(MIME).trim() || dt.getData(MIME_FALLBACK).trim();
    if (v) return v;
    const plain = dt.getData("text/plain").trim();
    return BLOCK_RE.test(plain) ? plain.toLowerCase() : null;
}

function isContainerType(type: string): boolean {
    return CONTAINER_TYPES.has(type);
}

function hasDragType(dt: DataTransfer, type: string): boolean {
    return Array.from(dt.types || []).includes(type);
}

/** Convert block.styles + width/height props into React inline styles. */
function toInlineStyle(block: BlockSchema): React.CSSProperties {
    const css: Record<string, string | number> = {};
    if (block.styles) {
        for (const [k, v] of Object.entries(block.styles)) {
            if (k === "pointer-events" || k === "pointerEvents") continue;
            if (typeof v === "string" || typeof v === "number") css[k] = v;
        }
    }
    const w = block.properties?.width;
    if ((typeof w === "string" || typeof w === "number") && css.width === undefined) css.width = w;
    const h = block.properties?.height;
    if ((typeof h === "string" || typeof h === "number") && css.height === undefined) css.height = h;
    // Ensure the editor can always receive pointer events for selection/drag.
    (css as React.CSSProperties).pointerEvents = "auto";
    return css as React.CSSProperties;
}

/* ═══════════════════  Main Canvas  ═════════════════ */

const Canvas: React.FC = () => {
    const { project, selectedPageId, selectedComponentId, viewport } = useProjectStore();
    const { isDragging: isPointerDragging, mouseX, mouseY } = useDragDrop();

    // Drop insertion indicator state
    const [insertion, setInsertion] = useState<InsertionPoint | null>(null);
    const [isDragActive, setDragActive] = useState(false);

    // Viewport measurement
    const [vpSize, setVpSize] = useState({ w: 0, h: 0 });
    const scrollRef = useRef<HTMLDivElement>(null);

    const rootBlocks = getRootBlocks();
    const componentRoot = selectedComponentId ? rootBlocks[0] ?? null : null;
    const pageRoot = !selectedComponentId && rootBlocks.length === 1 ? rootBlocks[0] : null;
    const pageRootId = !selectedComponentId && selectedPageId
        ? (project?.pages.find((p) => p.id === selectedPageId && !p.archived)?.root_block_id ?? null)
        : null;
    const effectiveRootId = componentRoot?.id ?? pageRoot?.id ?? pageRootId ?? null;

    const topBlocks = componentRoot
        ? getBlockChildren(componentRoot.id)
        : pageRoot
            ? getBlockChildren(pageRoot.id)
            : (effectiveRootId
                ? (project?.blocks.filter((b) => b.parent_id === effectiveRootId && !b.archived) ?? [])
                : rootBlocks);

    const topParentId = effectiveRootId;

    // ── Refs for use inside useEffects (avoids dependency-loop re-renders) ──
    const projectRef = useRef(project);
    const topParentIdRef = useRef(topParentId);
    const topBlocksRef = useRef(topBlocks);
    const insertionRef = useRef(insertion);

    // Sync refs on every render (so effects read latest values)
    useEffect(() => {
        projectRef.current = project;
        topParentIdRef.current = topParentId;
        topBlocksRef.current = topBlocks;
        insertionRef.current = insertion;
    });

    const ab = ARTBOARD_SIZES[viewport] || ARTBOARD_SIZES.desktop;
    const artW = viewport === "desktop" ? Math.max(ab.w, vpSize.w - 24) : ab.w;
    const artH = viewport === "desktop" ? Math.max(ab.h, vpSize.h - 24) : ab.h;

    // ── Viewport size tracking ──
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const sync = () => setVpSize({ w: el.clientWidth, h: el.clientHeight });
        sync();
        const ro = new ResizeObserver(sync);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // ── Scroll to top on page change ──
    useEffect(() => {
        if (!scrollRef.current || !selectedPageId) return;
        scrollRef.current.scrollTop = 0;
    }, [selectedPageId]);

    // ── Pointer-based drag: compute insertion point on mouse move ──
    const artboardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isPointerDragging || !artboardRef.current) return;
        setDragActive(true);

        // Find the block element under the pointer
        const els = document.elementsFromPoint(mouseX, mouseY);
        const blockEl = els.find(el => el.hasAttribute('data-block-id')) as HTMLElement | undefined;

        if (blockEl) {
            const blockId = blockEl.getAttribute('data-block-id')!;
            const block = projectRef.current?.blocks.find(b => b.id === blockId);
            const rect = blockEl.getBoundingClientRect();
            const yRatio = (mouseY - rect.top) / rect.height;
            const isContainer = block && CONTAINER_TYPES.has(block.block_type);

            if (isContainer && yRatio > 0.25 && yRatio < 0.75) {
                const children = getBlockChildren(blockId);
                setInsertion(prev => {
                    if (prev?.parentId === blockId && prev?.index === children.length) return prev;
                    return { parentId: blockId, index: children.length };
                });
            } else {
                const parentId = block?.parent_id ?? topParentIdRef.current;
                const siblings = parentId
                    ? (projectRef.current?.blocks.filter(b => b.parent_id === parentId && !b.archived) ?? [])
                    : topBlocksRef.current;
                const idx = siblings.findIndex(b => b.id === blockId);
                if (idx >= 0) {
                    const newIdx = yRatio <= 0.5 ? idx : idx + 1;
                    setInsertion(prev => {
                        if (prev?.parentId === parentId && prev?.index === newIdx) return prev;
                        return { parentId, index: newIdx };
                    });
                } else if (topParentIdRef.current) {
                    const tpId = topParentIdRef.current;
                    const tLen = topBlocksRef.current.length;
                    setInsertion(prev => {
                        if (prev?.parentId === tpId && prev?.index === tLen) return prev;
                        return { parentId: tpId, index: tLen };
                    });
                }
            }
        } else if (artboardRef.current?.contains(els[0] as Node) || artboardRef.current === els[0]) {
            // Over empty artboard area
            const tpId = topParentIdRef.current;
            if (tpId) {
                const tLen = topBlocksRef.current.length;
                setInsertion(prev => {
                    if (prev?.parentId === tpId && prev?.index === tLen) return prev;
                    return { parentId: tpId, index: tLen };
                });
            }
        }
    }, [isPointerDragging, mouseX, mouseY]);

    // Clear pointer drag state when pointer drag ends
    useEffect(() => {
        if (!isPointerDragging && isDragActive) {
            // Small delay to let the drop event fire first
            const t = setTimeout(() => {
                setInsertion(null);
                setDragActive(false);
            }, 50);
            return () => clearTimeout(t);
        }
    }, [isPointerDragging]);

    // ── Listen for custom pointer-drop event ──
    useEffect(() => {
        const handler = async (e: Event) => {
            const detail = (e as CustomEvent).detail as {
                payload: DragPayload;
                x: number;
                y: number;
            };
            if (!detail?.payload) return;

            // Check if the drop landed on our artboard
            const els = document.elementsFromPoint(detail.x, detail.y);
            if (!artboardRef.current) return;
            const isOverArtboard = els.some(
                el => artboardRef.current!.contains(el) || el === artboardRef.current
            );
            if (!isOverArtboard) {
                setInsertion(null);
                setDragActive(false);
                return;
            }

            const target = insertionRef.current
                ?? (topParentIdRef.current
                    ? { parentId: topParentIdRef.current, index: topBlocksRef.current.length }
                    : null);

            if (!target) {
                setInsertion(null);
                setDragActive(false);
                return;
            }

            const { payload } = detail;

            // Case A: reorder existing block
            if (payload.moveId) {
                try {
                    await moveBlock(payload.moveId, target.parentId, target.index);
                } catch (err) {
                    console.error("[Canvas] pointer-drop move failed:", err);
                } finally {
                    setInsertion(null);
                    setDragActive(false);
                }
                return;
            }

            // Case B: new block from palette
            if (payload.type) {
                const name = payload.type.charAt(0).toUpperCase() + payload.type.slice(1);
                try {
                    await addBlockAtPosition(payload.type, name, 0, 0, payload.componentId, {
                        parentId: target.parentId ?? undefined,
                        index: target.index,
                    });
                } catch (err) {
                    console.error("[Canvas] pointer-drop failed:", err);
                } finally {
                    setInsertion(null);
                    setDragActive(false);
                }
            }
        };

        document.addEventListener("akasha-pointer-drop", handler);
        return () => document.removeEventListener("akasha-pointer-drop", handler);
    }, []);

    /* ────────────────  Drop handlers  ──────────────── */

    const clearDrop = useCallback(() => {
        setInsertion(null);
        setDragActive(false);
    }, []);

    /** Artboard-level dragover: if nothing else caught it, drop at end of root. */
    const onFrameDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = hasDragType(e.dataTransfer, MIME_MOVE) ? "move" : "copy";
        setDragActive(true);
        if (topParentId) {
            setInsertion({ parentId: topParentId, index: topBlocks.length });
        }
    }, [topParentId, topBlocks.length]);

    /** Final drop handler – creates or moves block. */
    const onFrameDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const target = insertion ?? (topParentId ? { parentId: topParentId, index: topBlocks.length } : null);
        clearDrop();

        if (!target) {
            (window as any).__akashaDragData = null;
            return;
        }

        // Case A: reordering an existing block
        let moveId = e.dataTransfer.getData(MIME_MOVE);
        // Fallback for WebView: use global storage if DataTransfer is empty
        if (!moveId && (window as any).__akashaDragData?.moveId) {
            moveId = (window as any).__akashaDragData.moveId;
        }
        if (moveId) {
            await moveBlock(moveId, target.parentId, target.index);
            (window as any).__akashaDragData = null;
            return;
        }

        // Case B: new block from palette
        let type = readBlockType(e.dataTransfer);
        let compId = e.dataTransfer.getData(MIME_COMPONENT) || undefined;
        // Fallback for WebView
        if (!type && (window as any).__akashaDragData?.type) {
            type = (window as any).__akashaDragData.type;
            compId = (window as any).__akashaDragData.componentId;
        }
        (window as any).__akashaDragData = null;
        if (!type) return;

        const name = type.charAt(0).toUpperCase() + type.slice(1);
        try {
            await addBlockAtPosition(type, name, 0, 0, compId, {
                parentId: target.parentId ?? undefined,
                index: target.index,
            });
        } catch (err) {
            console.error("[Canvas] drop failed:", err);
        }
    }, [insertion, clearDrop, topParentId, topBlocks.length]);

    const onFrameDragLeave = useCallback((e: React.DragEvent) => {
        const next = e.relatedTarget as Node | null;
        if (!next || !e.currentTarget.contains(next)) clearDrop();
    }, [clearDrop]);

    /* ────────────────  Early returns  ──────────────── */

    if (!project) {
        return (
            <div className="h-full flex items-center justify-center bg-[var(--ide-bg)]">
                <p className="text-sm text-[var(--ide-text-secondary)]">Open or create a project to get started.</p>
            </div>
        );
    }

    /* ────────────────  Render  ──────────────────────── */

    return (
        <div className="h-full bg-[var(--ide-canvas-bg)] flex flex-col overflow-hidden">
            {/* ── Viewport Switcher ── */}
            <ViewportBar viewport={viewport} artW={artW} artH={artH} />

            {/* ── Scroll container ── */}
            <div ref={scrollRef} className="flex-1 overflow-auto">
                {/* Gray surface */}
                <div
                    className="min-h-full flex justify-center py-3 canvas-bg"
                    onClick={() => selectBlock(null)}
                >
                    {/* Artboard (white page) */}
                    <div
                        ref={artboardRef}
                        className="bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] transition-[width] duration-300"
                        style={{ width: artW, minHeight: artH }}
                        onClick={(e) => e.stopPropagation()}
                        onDragOver={onFrameDragOver}
                        onDrop={onFrameDrop}
                        onDragLeave={onFrameDragLeave}
                    >
                        {/* Component editing banner */}
                        {selectedComponentId && (
                            <ComponentBanner
                                name={project.components?.find((c: BlockSchema) => c.id === selectedComponentId)?.name}
                            />
                        )}

                        {/* Frame body */}
                        <div className="relative p-4 min-h-[200px]">
                            {/* Page root label */}
                            {pageRoot && (
                                <div className="text-[9px] font-bold uppercase tracking-widest text-slate-300 mb-3 select-none">
                                    {pageRoot.name || "Page Root"}
                                </div>
                            )}

                            {topBlocks.length === 0 ? (
                                <EmptyDropZone
                                    parentId={topParentId}
                                    active={isDragActive}
                                    onDragOver={(parentId, e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        e.dataTransfer.dropEffect = hasDragType(e.dataTransfer, MIME_MOVE) ? "move" : "copy";
                                        setDragActive(true);
                                        if (parentId) setInsertion({ parentId, index: 0 });
                                    }}
                                    onDrop={onFrameDrop}
                                />
                            ) : (
                                <BlockList
                                    blocks={topBlocks}
                                    parentId={topParentId!}
                                    insertion={insertion}
                                    setInsertion={setInsertion}
                                    setDragActive={setDragActive}
                                    onDrop={onFrameDrop}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════  Block List  ══════════════════ */

interface BlockListProps {
    blocks: BlockSchema[];
    parentId: string;
    insertion: InsertionPoint | null;
    setInsertion: (ip: InsertionPoint | null) => void;
    setDragActive: (v: boolean) => void;
    onDrop: (e: React.DragEvent) => void;
}

/** Renders a list of sibling blocks with insertion indicators. */
const BlockList: React.FC<BlockListProps> = ({
    blocks, parentId, insertion, setInsertion, setDragActive, onDrop,
}) => (
    <div className="flex flex-col gap-1">
        {blocks.map((block, i) => (
            <React.Fragment key={block.id}>
                {/* Insertion line BEFORE this block */}
                {insertion?.parentId === parentId && insertion.index === i && (
                    <InsertionLine />
                )}

                <BlockNode
                    block={block}
                    parentId={parentId}
                    index={i}
                    insertion={insertion}
                    setInsertion={setInsertion}
                    setDragActive={setDragActive}
                    onDrop={onDrop}
                />
            </React.Fragment>
        ))}

        {/* Insertion line AFTER last block */}
        {insertion?.parentId === parentId && insertion.index === blocks.length && (
            <InsertionLine />
        )}
    </div>
);

/* ═══════════════════  Block Node  ══════════════════ */

interface BlockNodeProps {
    block: BlockSchema;
    parentId: string;
    index: number;
    insertion: InsertionPoint | null;
    setInsertion: (ip: InsertionPoint | null) => void;
    setDragActive: (v: boolean) => void;
    onDrop: (e: React.DragEvent) => void;
}

const BlockNode: React.FC<BlockNodeProps> = ({
    block, parentId, index, insertion, setInsertion, setDragActive, onDrop,
}) => {
    const { selectedBlockId } = useProjectStore();
    const { prepareDrag: preparePointerDrag } = useDragDrop();
    const selected = selectedBlockId === block.id;
    const [hovered, setHovered] = useState(false);
    const [editing, setEditing] = useState(false);
    const children = getBlockChildren(block.id);
    const container = isContainerType(block.block_type);

    /* ── Pointer-based drag for reorder (Tauri WebView compatible) ── */
    const onPointerDragStart = useCallback((e: React.MouseEvent) => {
        if (editing || e.button !== 0) return;
        // Don't start drag if clicking on content-editable or child buttons
        const target = e.target as HTMLElement;
        if (target.isContentEditable || target.closest("button")) return;

        e.stopPropagation();
        preparePointerDrag(
            {
                type: block.block_type,
                moveId: block.id,
                label: block.name || block.block_type,
            },
            e,
        );
    }, [block, editing, preparePointerDrag]);

    /* ── HTML5 Drag existing block for reorder (browser fallback) ── */
    const onDragStart = useCallback((e: React.DragEvent) => {
        e.stopPropagation();
        e.dataTransfer.setData(MIME_MOVE, block.id);
        e.dataTransfer.setData(MIME, block.block_type);
        e.dataTransfer.setData("text/plain", block.block_type);
        e.dataTransfer.effectAllowed = "move";

        // Store in global for WebView fallback
        (window as any).__akashaDragData = { type: block.block_type, moveId: block.id };

        // Ghost label
        const ghost = document.createElement("div");
        ghost.className = "px-2 py-1 rounded text-xs font-bold shadow-xl";
        ghost.style.background = "#6366f1";
        ghost.style.color = "#fff";
        ghost.innerText = block.name || block.block_type;
        ghost.style.position = "absolute";
        ghost.style.top = "-1000px";
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 0, 0);
        requestAnimationFrame(() => document.body.removeChild(ghost));
    }, [block]);

    /* ── Drag over this block → compute insertion point ── */
    const onBlockDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = hasDragType(e.dataTransfer, MIME_MOVE) ? "move" : "copy";
        setDragActive(true);

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const yRatio = (e.clientY - rect.top) / rect.height;

        if (container && yRatio > 0.25 && yRatio < 0.75) {
            // Drop INSIDE this container (at end of its children)
            setInsertion({ parentId: block.id, index: children.length });
        } else if (yRatio <= 0.5) {
            // Drop BEFORE this block in parent
            setInsertion({ parentId, index });
        } else {
            // Drop AFTER this block in parent
            setInsertion({ parentId, index: index + 1 });
        }
    }, [block.id, parentId, index, container, children.length, setInsertion, setDragActive]);

    /* ── Click / double-click ── */
    const onClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (!editing) selectBlock(block.id);
    }, [block.id, editing]);

    const onDoubleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        const textTypes = ["text", "paragraph", "heading", "button", "link"];
        if (textTypes.includes(block.block_type)) {
            setEditing(true);
            selectBlock(block.id);
        }
    }, [block.block_type, block.id]);

    /* ── Inline text edit ── */
    const onBlur = useCallback((e: React.FocusEvent) => {
        setEditing(false);
        const newText = (e.currentTarget as HTMLElement).innerText.trim();
        const oldText = (block.properties?.text as string) ?? "";
        if (newText !== oldText) {
            updateBlockProperty(block.id, "text", newText);
        }
    }, [block.id, block.properties?.text]);

    const onKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            (e.currentTarget as HTMLElement).blur();
        }
        if (e.key === "Escape") {
            setEditing(false);
            (e.currentTarget as HTMLElement).blur();
        }
    }, []);

    /* ── Outline class ── */
    const outlineClass = selected
        ? "ring-2 ring-indigo-500 ring-offset-1"
        : hovered && !editing
            ? "ring-1 ring-indigo-300/50"
            : "";

    const baseClasses = blockAppearance(block.block_type);

    return (
        <div
            className={`relative group ${outlineClass} rounded-lg transition-shadow duration-100`}
            style={toInlineStyle(block)}
            draggable={!editing}
            onDragStart={onDragStart}
            onDragOver={onBlockDragOver}
            onDrop={onDrop}
            onMouseDown={onPointerDragStart}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            data-block-id={block.id}
        >
            {/* ── Selection / hover label ── */}
            {(selected || hovered) && !editing && (
                <div
                    className={`absolute -top-5 left-0 z-20 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-t pointer-events-none whitespace-nowrap ${selected
                            ? "bg-indigo-500 text-white"
                            : "bg-slate-100 text-slate-400 border border-slate-200/60"
                        }`}
                >
                    {block.name || block.block_type}
                </div>
            )}

            {/* ── Resize handles (selected only) ── */}
            {selected && !editing && <ResizeHandles />}

            {/* ── Block visual ── */}
            <div className={baseClasses}>
                {editing ? (
                    <div
                        contentEditable
                        suppressContentEditableWarning
                        className="outline-none min-h-[1em] cursor-text"
                        onBlur={onBlur}
                        onKeyDown={onKeyDown}
                        ref={(el) => {
                            if (el) {
                                const txt = (block.properties?.text as string) || "";
                                if (el.innerText.trim() !== txt) el.innerText = txt;
                                el.focus();
                            }
                        }}
                    />
                ) : (
                    <BlockVisual block={block} />
                )}

                {/* ── Children (container blocks) ── */}
                {container && children.length > 0 && (
                    <div className="mt-2">
                        <BlockList
                            blocks={children}
                            parentId={block.id}
                            insertion={insertion}
                            setInsertion={setInsertion}
                            setDragActive={setDragActive}
                            onDrop={onDrop}
                        />
                    </div>
                )}

                {/* ── Empty container placeholder ── */}
                {container && children.length === 0 && (
                    <div
                        className={`min-h-[48px] mt-2 border border-dashed rounded-lg flex items-center justify-center text-xs transition-colors cursor-default ${insertion?.parentId === block.id
                                ? "border-indigo-400 bg-indigo-50/40 text-indigo-400"
                                : "border-slate-200 text-slate-300"
                            }`}
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            e.dataTransfer.dropEffect = hasDragType(e.dataTransfer, MIME_MOVE) ? "move" : "copy";
                            setDragActive(true);
                            setInsertion({ parentId: block.id, index: 0 });
                        }}
                        onDrop={onDrop}
                    >
                        Drop here
                    </div>
                )}
            </div>
        </div>
    );
};

/* ═══════════════════  Block Visual  ════════════════ */

const BlockVisual: React.FC<{ block: BlockSchema }> = ({ block }) => {
    const { project } = useProjectStore();
    const text = block.properties?.text as string | undefined;

    switch (block.block_type) {
        case "instance": {
            const master = project?.components?.find((c: BlockSchema) => c.id === block.component_id);
            return (
                <div className="flex flex-col items-center justify-center p-4 min-h-[60px]">
                    <span className="text-xl mb-1">🧩</span>
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                        {master?.name || "Component"}
                    </span>
                </div>
            );
        }
        case "heading":
            return <h2 className="text-lg font-bold text-slate-800 leading-tight">{text || "Heading"}</h2>;
        case "text":
        case "paragraph":
            return <p className="text-sm text-slate-600 leading-relaxed">{text || "Text content..."}</p>;
        case "button":
            return <span className="text-sm font-medium">{text || "Button"}</span>;
        case "link":
            return <span className="text-sm text-indigo-500 underline underline-offset-2">{text || "Link"}</span>;
        case "image":
            return (
                <div className="flex flex-col items-center justify-center py-6 text-slate-300">
                    <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-[10px]">Image</span>
                </div>
            );
        case "video":
            return (
                <div className="flex flex-col items-center justify-center py-6 text-slate-300">
                    <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-[10px]">Video</span>
                </div>
            );
        case "input":
            return (
                <input
                    type="text"
                    placeholder={text || "Input field..."}
                    className="w-full outline-none bg-transparent text-sm text-slate-500 pointer-events-none"
                    disabled
                    tabIndex={-1}
                />
            );
        case "textarea":
            return <div className="text-sm text-slate-400 italic">Multi-line input...</div>;
        case "select":
            return (
                <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">{text || "Select..."}</span>
                    <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            );
        case "checkbox":
            return (
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border-2 border-slate-300 shrink-0" />
                    <span className="text-sm text-slate-600">{text || "Checkbox"}</span>
                </div>
            );
        default:
            return (
                <span className="text-xs text-slate-400 font-medium">{block.name || block.block_type}</span>
            );
    }
};

/* ═══════════════════  Appearance  ══════════════════ */

function blockAppearance(type: string): string {
    switch (type) {
        case "container":
            return "p-4 bg-white rounded-xl border border-slate-200 min-h-[60px]";
        case "section":
            return "p-6 bg-gradient-to-b from-slate-50 to-white rounded-xl border border-slate-200/80 min-h-[60px]";
        case "card":
            return "p-5 bg-white rounded-xl shadow-sm border border-slate-100";
        case "columns":
        case "flex":
            return "p-4 bg-white rounded-xl border border-blue-100 min-h-[60px] flex gap-3";
        case "grid":
            return "p-4 bg-white rounded-xl border border-purple-100 min-h-[60px]";
        case "form":
            return "p-5 bg-white rounded-xl border border-slate-200 min-h-[60px]";
        case "heading":
            return "p-3";
        case "text":
        case "paragraph":
            return "p-3";
        case "button":
            return "px-5 py-2.5 bg-indigo-500 text-white rounded-lg text-center font-medium shadow-sm inline-block";
        case "image":
            return "bg-slate-50 rounded-xl border border-dashed border-slate-200 min-h-[80px]";
        case "input":
            return "border border-slate-300 rounded-lg px-3 py-2.5 bg-white";
        case "textarea":
            return "border border-slate-300 rounded-lg px-3 py-2.5 bg-white min-h-[60px]";
        case "select":
            return "border border-slate-300 rounded-lg px-3 py-2.5 bg-white";
        case "link":
            return "p-2";
        case "instance":
            return "border-2 border-dashed border-indigo-400/50 rounded-xl bg-indigo-50/10 min-h-[60px]";
        default:
            return "p-3 bg-white rounded-lg border border-slate-200 min-h-[36px]";
    }
}

/* ═══════════════════  Sub-components  ══════════════ */

/** Blue insertion indicator line. */
const InsertionLine: React.FC = () => (
    <div className="relative h-[3px] my-[-1px] z-30 pointer-events-none">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-indigo-500 rounded-full shadow-[0_0_6px_rgba(99,102,241,0.5)]" />
        <div className="absolute -left-[3px] -top-[3px] w-[9px] h-[9px] rounded-full bg-indigo-500" />
    </div>
);

/** Corner resize handles for selected block. */
const ResizeHandles: React.FC = () => (
    <>
        <div className="absolute -top-[3px] -left-[3px] w-[7px] h-[7px] bg-white border-2 border-indigo-500 rounded-full z-30 cursor-nw-resize" />
        <div className="absolute -top-[3px] -right-[3px] w-[7px] h-[7px] bg-white border-2 border-indigo-500 rounded-full z-30 cursor-ne-resize" />
        <div className="absolute -bottom-[3px] -left-[3px] w-[7px] h-[7px] bg-white border-2 border-indigo-500 rounded-full z-30 cursor-sw-resize" />
        <div className="absolute -bottom-[3px] -right-[3px] w-[7px] h-[7px] bg-white border-2 border-indigo-500 rounded-full z-30 cursor-se-resize" />
    </>
);

/** Empty canvas drop zone. */
const EmptyDropZone: React.FC<{
    parentId: string | null;
    active: boolean;
    onDragOver: (parentId: string | null, e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
}> = ({ parentId, active, onDragOver, onDrop }) => (
    <div
        className={`min-h-[180px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 transition-colors ${active
                ? "border-indigo-400 bg-indigo-50/30 text-indigo-400"
                : "border-slate-200 text-slate-300"
            }`}
        onDragOver={(e) => onDragOver(parentId, e)}
        onDrop={onDrop}
    >
        <svg className="w-8 h-8 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v16m8-8H4" />
        </svg>
        <span className="text-xs font-medium">Click or drag components here</span>
    </div>
);

/** Component editing banner at top of artboard. */
const ComponentBanner: React.FC<{ name?: string }> = ({ name }) => (
    <div className="bg-indigo-600 text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
            <span className="text-sm">🧩</span>
            <div>
                <p className="text-[9px] text-indigo-200 font-bold uppercase tracking-wider leading-none">Editing Component</p>
                <p className="text-xs font-bold truncate max-w-[200px]">{name || "Unknown"}</p>
            </div>
        </div>
        <button
            onClick={(e) => { e.stopPropagation(); closeComponentEditor(); }}
            className="px-3 py-1 text-[10px] font-bold bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
        >
            Exit
        </button>
    </div>
);

/** Viewport size switcher bar. */
const ViewportBar: React.FC<{
    viewport: string;
    artW: number;
    artH: number;
}> = ({ viewport, artW, artH }) => {
    const icons: Record<string, React.ReactNode> = {
        desktop: (
            <svg className="w-3.5 h-3.5 inline mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
        ),
        tablet: (
            <svg className="w-3.5 h-3.5 inline mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
        ),
        mobile: (
            <svg className="w-3.5 h-3.5 inline mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
        ),
    };

    return (
        <div className="h-8 bg-[var(--ide-chrome)] border-b border-[var(--ide-border)] px-4 flex items-center justify-center gap-1 shrink-0 select-none">
            {Object.entries(ARTBOARD_SIZES).map(([key, val]) => (
                <button
                    key={key}
                    onClick={() => setViewport(key as "desktop" | "tablet" | "mobile")}
                    className={`h-6 px-3 text-[10px] font-semibold rounded transition-colors ${viewport === key
                            ? "bg-[var(--ide-primary)] text-white"
                            : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-text)]/10"
                        }`}
                    title={`${val.label} (${val.w}px)`}
                >
                    {icons[key]}
                    {val.label}
                </button>
            ))}
            <span className="ml-2 text-[9px] font-mono text-[var(--ide-text-muted)] tabular-nums">
                {artW} &times; {artH}
            </span>
        </div>
    );
};

export default Canvas;
