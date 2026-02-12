/**
 * Canvas Component
 *
 * Freeform visual editing surface. Root blocks are absolutely positioned
 * inside a viewport-sized artboard. Children inside containers use flow layout.
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
    selectBlock,
    getBlockChildren,
    getRootBlocks,
    addBlockAtPosition,
    updateBlockPosition,
    setViewport,
    closeComponentEditor,
} from "../../stores/projectStore";
import { useProjectStore } from "../../hooks/useProjectStore";
import { BlockSchema } from "../../hooks/useTauri";

// ─── Constants ───────────────────────────────────────

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

const CONTAINER_TYPES = new Set([
    "container", "section", "form", "card", "columns", "column", "flex", "grid",
]);

// ─── Drag State ──────────────────────────────────────

interface DragState {
    blockId: string;
    offsetX: number;
    offsetY: number;
    element: HTMLElement;
    hasMoved: boolean;
    startX: number;
    startY: number;
}

// ─── Helpers ─────────────────────────────────────────

/** Read the actual block type string (only works during drop). */
function readBlockType(dt: DataTransfer): string | null {
    const v = dt.getData(MIME_BLOCK).trim()
        || dt.getData(MIME_BLOCK_FALLBACK).trim();
    if (v) return v;
    const plain = dt.getData(MIME_PLAIN).trim();
    return BLOCK_TYPE_RE.test(plain) ? plain.toLowerCase() : null;
}

function blockPosition(block: BlockSchema, idx: number): { x: number; y: number } {
    const x = typeof block.properties.x === "number" ? block.properties.x : 40 + (idx % 4) * 280;
    const y = typeof block.properties.y === "number" ? block.properties.y : 40 + Math.floor(idx / 4) * 180;
    return { x, y };
}

function blockWidth(type: string): number {
    switch (type) {
        case "container": case "section": case "form": case "grid": return 420;
        case "card": return 320;
        case "columns": case "flex": return 520;
        case "heading": return 320;
        case "text": case "paragraph": return 260;
        case "image": return 240;
        case "input": case "textarea": case "select": return 260;
        case "button": return 160;
        default: return 220;
    }
}

function blockMinHeight(type: string): number {
    switch (type) {
        case "container": case "section": case "form": case "card":
        case "columns": case "column": case "flex": case "grid":
            return 80;
        case "image": case "video":
            return 100;
        case "textarea":
            return 60;
        default:
            return 36;
    }
}

function clamp(value: number, min: number, max: number): number {
    if (max < min) return min;
    return Math.min(Math.max(value, min), max);
}

function blockClasses(type: string): string {
    switch (type) {
        case "container":
            return "p-4 bg-white rounded-xl border border-slate-300 min-h-[80px] hover:border-indigo-300 transition-colors";
        case "section":
            return "p-6 bg-gradient-to-b from-slate-50 to-white rounded-xl border border-slate-200/80";
        case "text": case "paragraph":
            return "p-3 bg-white rounded-lg border border-slate-200/60";
        case "heading":
            return "p-3 bg-white rounded-lg border border-slate-200/60";
        case "button":
            return "px-5 py-2.5 bg-gradient-to-b from-indigo-500 to-indigo-600 text-white rounded-lg text-center shadow-sm shadow-indigo-500/25 font-medium";
        case "image":
            return "bg-slate-50 rounded-xl border border-dashed border-slate-300/60 min-h-[100px] flex items-center justify-center";
        case "input":
            return "border border-slate-300 rounded-lg px-3 py-2.5 bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]";
        case "textarea":
            return "border border-slate-300 rounded-lg px-3 py-2.5 bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] min-h-[60px]";
        case "select":
            return "border border-slate-300 rounded-lg px-3 py-2.5 bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]";
        case "form":
            return "p-5 bg-white rounded-xl border border-slate-200/80 shadow-sm";
        case "card":
            return "p-5 bg-white rounded-xl shadow-lg shadow-slate-200/50 border border-slate-100";
        case "columns": case "flex":
            return "p-4 bg-white rounded-xl border border-blue-200/50 min-h-[80px]";
        case "grid":
            return "p-4 bg-white rounded-xl border border-purple-200/50 min-h-[80px]";
        case "instance":
            return "p-0 border-2 border-dashed border-indigo-400/60 rounded-xl overflow-hidden bg-indigo-50/10 hover:bg-indigo-50/30 transition-colors";
        default:
            return "p-3 bg-white rounded-lg border border-slate-200/80 min-h-[40px]";
    }
}

// ─── Main Canvas ─────────────────────────────────────

const Canvas: React.FC = () => {
    const { project, selectedPageId, selectedComponentId, viewport } = useProjectStore();
    const [isDragOver, setIsDragOver] = useState(false);
    const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
    const dragRef = useRef<DragState | null>(null);
    const artboardRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const rootBlocks = getRootBlocks();

    const ab = ARTBOARD_SIZES[viewport] || ARTBOARD_SIZES.desktop;
    const artboardWidth = viewport === "desktop"
        ? Math.max(ab.width, viewportSize.width - ARTBOARD_MARGIN * 2)
        : ab.width;
    const artboardMinHeight = viewport === "desktop"
        ? Math.max(ab.minHeight, viewportSize.height - ARTBOARD_MARGIN * 2)
        : ab.minHeight;
    const surfaceW = Math.max(artboardWidth + ARTBOARD_MARGIN * 2, viewportSize.width);
    const surfaceH = Math.max(artboardMinHeight + ARTBOARD_MARGIN * 2, viewportSize.height);

    // Track available editor viewport so canvas can expand/shrink with side panels.
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        const update = () => {
            setViewportSize({
                width: el.clientWidth,
                height: el.clientHeight,
            });
        };

        update();

        const observer = new ResizeObserver(() => update());
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // Center artboard on mount / page change
    useEffect(() => {
        if (scrollRef.current && selectedPageId) {
            const el = scrollRef.current;
            const artboardLeft = Math.max(ARTBOARD_MARGIN, (surfaceW - artboardWidth) / 2);
            const fitOffset = Math.max(0, (el.clientWidth - artboardWidth) / 2);
            el.scrollLeft = Math.max(0, artboardLeft - fitOffset);
            el.scrollTop = 0;
        }
    }, [selectedPageId, surfaceW, artboardWidth]);

    // ── Free-position drag via global listeners ──
    useEffect(() => {
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

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, []);

    const startDrag = useCallback((e: React.MouseEvent, block: BlockSchema) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const el = e.currentTarget as HTMLElement;
        const r = el.getBoundingClientRect();
        dragRef.current = {
            blockId: block.id,
            offsetX: e.clientX - r.left,
            offsetY: e.clientY - r.top,
            element: el,
            hasMoved: false,
            startX: e.clientX,
            startY: e.clientY,
        };
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
    }, []);

    // ── Palette drop handlers ──
    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "copy";
        setIsDragOver(true);
    }, []);

    const onDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const type = readBlockType(e.dataTransfer);
        const componentId = e.dataTransfer.getData("application/akasha-component-id");

        if (!type || !artboardRef.current) {
            return;
        }

        try {
            const r = artboardRef.current.getBoundingClientRect();
            const boundedWidth = Math.min(blockWidth(type), Math.max(120, r.width - BLOCK_BOUNDARY_PADDING * 2));
            const boundedHeight = blockMinHeight(type);
            const maxX = Math.max(BLOCK_BOUNDARY_PADDING, r.width - boundedWidth - BLOCK_BOUNDARY_PADDING);
            const maxY = Math.max(BLOCK_BOUNDARY_PADDING, r.height - boundedHeight - BLOCK_BOUNDARY_PADDING);
            const x = Math.round(clamp(e.clientX - r.left, BLOCK_BOUNDARY_PADDING, maxX));
            const y = Math.round(clamp(e.clientY - r.top, BLOCK_BOUNDARY_PADDING, maxY));

            // Auto-generate name based on component type
            const name = `${type.charAt(0).toUpperCase() + type.slice(1)}`;
            await addBlockAtPosition(type, name, x, y, componentId || undefined);

        } catch (err) {
            console.error("[Canvas DnD] Failed to add block at drop position:", err);
        }
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent) => {
        const next = e.relatedTarget as Node | null;
        if (!next || !e.currentTarget.contains(next)) setIsDragOver(false);
    }, []);

    // ── Early returns ──
    if (!project) return <WelcomeScreen />;

    return (
        <div className="h-full bg-[var(--ide-canvas-bg)] flex flex-col relative overflow-hidden">
            {/* Viewport Switcher Bar */}
            <div className="h-8 bg-[var(--ide-chrome)] border-b border-[var(--ide-border)] px-4 flex items-center justify-center gap-1 shrink-0 select-none">
                {(Object.entries(ARTBOARD_SIZES) as [string, { width: number; minHeight: number; label: string }][]).map(([key, val]) => (
                    <button
                        key={key}
                        onClick={() => setViewport(key as "desktop" | "tablet" | "mobile")}
                        className={`h-6 px-3 text-[10px] font-semibold rounded transition-colors ${viewport === key
                            ? "bg-[var(--ide-primary)] text-white"
                            : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-text)]/10"
                            }`}
                        title={`${val.label} (${val.width}px)`}
                    >
                        {key === "desktop" && (
                            <svg className="w-3.5 h-3.5 inline mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        )}
                        {key === "tablet" && (
                            <svg className="w-3.5 h-3.5 inline mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                        )}
                        {key === "mobile" && (
                            <svg className="w-3.5 h-3.5 inline mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                        )}
                        {val.label}
                    </button>
                ))}
                <span className="ml-2 text-[9px] font-mono text-[var(--ide-text-muted)] tabular-nums">
                    {artboardWidth} &times; {artboardMinHeight}
                </span>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-auto relative">
                {/* Surface */}
                <div
                    className="relative canvas-bg select-none"
                    style={{ width: surfaceW, height: surfaceH }}
                    onClick={() => selectBlock(null)}
                >
                    {/* ── Artboard ── */}
                    <div
                        className="absolute bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] flex flex-col transition-[width,min-height] duration-500 ease-[cubic-bezier(0.2,0,0,1)]"
                        style={{
                            left: Math.max(ARTBOARD_MARGIN, (surfaceW - artboardWidth) / 2),
                            top: ARTBOARD_MARGIN,
                            width: artboardWidth,
                            minHeight: artboardMinHeight,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* ── Content Area (clean white page) ── */}
                        <div
                            ref={artboardRef}
                            className={`flex-1 relative bg-white overflow-hidden transition-colors duration-200 ${isDragOver ? "bg-indigo-50/30" : ""}`}
                            style={{ minHeight: artboardMinHeight }}
                            onClick={() => selectBlock(null)}
                            onDragOver={onDragOver}
                            onDrop={onDrop}
                            onDragLeave={onDragLeave}
                        >
                            {/* Component Editing Banner */}
                            {project && selectedComponentId && (
                                <div className="absolute top-0 left-0 right-0 z-40 bg-indigo-600/95 backdrop-blur-sm text-white px-4 py-2 flex items-center justify-between shadow-lg border-b border-indigo-500/50">
                                    <div className="flex items-center gap-2">
                                        <div className="bg-white/20 p-1.5 rounded-lg">
                                            <span className="text-sm">🧩</span>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-indigo-100 font-bold uppercase tracking-wider leading-none">Editing Master Component</p>
                                            <h3 className="text-xs font-bold truncate max-w-[150px]">
                                                {project.components.find(c => c.id === selectedComponentId)?.name || "Unknown Component"}
                                            </h3>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); closeComponentEditor(); }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-[10px] font-bold transition-all border border-white/10 active:scale-95"
                                    >
                                        Exit Editor
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            )}

                            <div className="pointer-events-none absolute inset-3 rounded-lg border border-slate-200/90 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.08)]" />

                            {/* Drop feedback */}
                            {isDragOver && (
                                <div className="pointer-events-none absolute inset-0 z-30">
                                    <div className="absolute inset-4 border-2 border-dashed border-indigo-400/40 bg-indigo-500/[0.02]" />
                                </div>
                            )}

                            {/* Blocks */}
                            {rootBlocks.map((block, idx) => (
                                <CanvasBlock
                                    key={block.id}
                                    block={block}
                                    index={idx}
                                    artboardWidth={artboardWidth}
                                    artboardHeight={artboardMinHeight}
                                    onMouseDown={(e) => startDrag(e, block)}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Canvas Block ────────────────────────────────────

interface CanvasBlockProps {
    block: BlockSchema;
    index: number;
    artboardWidth: number;
    artboardHeight: number;
    onMouseDown: (e: React.MouseEvent) => void;
}

const CanvasBlock: React.FC<CanvasBlockProps> = ({ block, index, artboardWidth, artboardHeight, onMouseDown }) => {
    const { selectedBlockId } = useProjectStore();
    const selected = selectedBlockId === block.id;
    const children = getBlockChildren(block.id);
    const isContainer = CONTAINER_TYPES.has(block.block_type);
    const rawPos = blockPosition(block, index);
    const w = Math.min(blockWidth(block.block_type), Math.max(120, artboardWidth - BLOCK_BOUNDARY_PADDING * 2));
    const minH = blockMinHeight(block.block_type);
    const maxX = Math.max(BLOCK_BOUNDARY_PADDING, artboardWidth - w - BLOCK_BOUNDARY_PADDING);
    const maxY = Math.max(BLOCK_BOUNDARY_PADDING, artboardHeight - minH - BLOCK_BOUNDARY_PADDING);
    const pos = {
        x: clamp(rawPos.x, BLOCK_BOUNDARY_PADDING, maxX),
        y: clamp(rawPos.y, BLOCK_BOUNDARY_PADDING, maxY),
    };

    return (
        <div
            className={[
                "absolute group cursor-grab active:cursor-grabbing transition-shadow duration-150",
                selected
                    ? "ring-2 ring-indigo-500 ring-offset-1 ring-offset-white shadow-[0_8px_30px_rgba(99,102,241,0.25)] z-20"
                    : "hover:shadow-lg hover:ring-1 hover:ring-slate-300/50 z-10",
            ].join(" ")}
            style={{ left: pos.x, top: pos.y, width: w, minHeight: minH }}
            onMouseDown={onMouseDown}
            data-block-id={block.id}
            // Allow palette drag-over events to bubble through to the artboard
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
        >
            {/* Hover label for structure visibility */}
            {!selected && isContainer && (
                <div className="absolute -top-5 left-0 text-[9px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none uppercase tracking-wider font-semibold z-20 bg-white/80 px-1 rounded shadow-sm border border-slate-100">
                    {block.name || block.block_type}
                </div>
            )}
            {/* Selection chrome */}
            {selected && (
                <>
                    <div className="absolute -top-6 left-0 bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-t-md z-10 pointer-events-none uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
                        <svg className="w-2.5 h-2.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                        {block.name || block.block_type}
                    </div>
                    <div className="absolute -top-[3px] -left-[3px] w-[7px] h-[7px] bg-white border-2 border-indigo-500 rounded-full z-30" />
                    <div className="absolute -top-[3px] -right-[3px] w-[7px] h-[7px] bg-white border-2 border-indigo-500 rounded-full z-30" />
                    <div className="absolute -bottom-[3px] -left-[3px] w-[7px] h-[7px] bg-white border-2 border-indigo-500 rounded-full z-30" />
                    <div className="absolute -bottom-[3px] -right-[3px] w-[7px] h-[7px] bg-white border-2 border-indigo-500 rounded-full z-30" />
                </>
            )}

            <div className={blockClasses(block.block_type)}>
                <BlockContent block={block} />
                {isContainer && children.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                        {children.map((c) => <ChildBlock key={c.id} block={c} />)}
                    </div>
                )}
                {isContainer && children.length === 0 && (
                    <div className="min-h-[48px] border border-dashed border-slate-200/80 rounded-lg flex items-center justify-center text-slate-300 text-xs mt-2">
                        Drop children here
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Child Block ─────────────────────────────────────

const ChildBlock: React.FC<{ block: BlockSchema }> = ({ block }) => {
    const { selectedBlockId } = useProjectStore();
    const selected = selectedBlockId === block.id;
    const children = getBlockChildren(block.id);
    const isContainer = CONTAINER_TYPES.has(block.block_type);

    return (
        <div
            className={[
                "relative transition-all cursor-pointer",
                selected ? "outline outline-2 outline-indigo-500 outline-offset-1 rounded-lg" : "",
                blockClasses(block.block_type),
            ].filter(Boolean).join(" ")}
            onClick={(e) => { e.stopPropagation(); selectBlock(block.id); }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
        >
            {selected && (
                <div className="absolute -top-5 left-0 bg-indigo-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm z-10 pointer-events-none whitespace-nowrap">
                    {block.name || block.block_type}
                </div>
            )}
            <BlockContent block={block} />
            {isContainer && children.length > 0 && (
                <div className="mt-1 space-y-1">
                    {children.map((c) => <ChildBlock key={c.id} block={c} />)}
                </div>
            )}
        </div>
    );
};

// ─── Block Content ───────────────────────────────────

const BlockContent: React.FC<{ block: BlockSchema }> = ({ block }) => {
    const { project } = useProjectStore();
    const text = block.properties.text as string | undefined;

    switch (block.block_type) {
        case "instance": {
            const master = project?.components.find(c => c.id === block.component_id);
            return (
                <div className="flex flex-col items-center justify-center p-4 min-h-[80px]">
                    <span className="text-2xl mb-1">🧩</span>
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest text-center">
                        {master ? master.name : "Unknown Component"}
                    </span>
                    <span className="text-[9px] text-indigo-400 mt-0.5">Instance</span>
                </div>
            );
        }
        case "text": case "paragraph":
            return <p className="text-slate-600 text-sm leading-relaxed">{text || "Text content..."}</p>;
        case "heading":
            return <h2 className="text-slate-800 text-lg font-bold leading-tight">{text || "Heading"}</h2>;
        case "button":
            return <span className="text-sm">{text || "Button"}</span>;
        case "image":
            return (
                <div className="text-slate-300 text-center py-6">
                    <svg className="w-10 h-10 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-[11px] text-slate-400">Image</span>
                </div>
            );
        case "input":
            return (
                <div className="flex items-center gap-2">
                    <input type="text" placeholder={text || "Input field..."} className="w-full outline-none bg-transparent text-sm text-slate-500" disabled />
                </div>
            );
        case "textarea":
            return <div className="text-sm text-slate-400 italic">Multi-line input...</div>;
        case "select":
            return (
                <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">{text || "Select..."}</span>
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            );
        case "link":
            return <span className="text-sm text-indigo-500 underline underline-offset-2">{text || "Link text"}</span>;
        case "checkbox":
            return (
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border-2 border-slate-300 shrink-0" />
                    <span className="text-sm text-slate-600">{text || "Checkbox label"}</span>
                </div>
            );
        case "video":
            return (
                <div className="text-slate-300 text-center py-6">
                    <svg className="w-10 h-10 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-[11px] text-slate-400">Video</span>
                </div>
            );
        default:
            return (
                <span className="text-slate-400 text-xs font-medium">
                    {block.name || block.block_type}
                </span>
            );
    }
};

// ─── No Page ─────────────────────────────────────────
// (No page selected is now handled by showing an empty artboard —
//  auto-select logic in projectStore ensures a page is always selected)

// ─── Welcome Screen ──────────────────────────────────

const WelcomeScreen: React.FC = () => (
    <div className="h-full flex items-center justify-center p-12 bg-[var(--ide-bg)]">
        <div className="text-center animate-fade-in">
            <p className="text-sm text-[var(--ide-text-secondary)]">
                Open or create a project to get started.
            </p>
        </div>
    </div>
);

export default Canvas;
