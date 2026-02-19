/**
 * CraftFrame — the main canvas viewport.
 *
 * Replaces the old Canvas.tsx. Renders:
 * - ViewportBar (desktop/tablet/mobile switcher)
 * - Artboard (white page area)
 * - craft.js <Frame> that renders the node tree
 * - Empty state when no blocks exist
 *
 * Loads blocks from the backend on page change and deserializes them
 * into craft.js's internal state.
 */

import React, { useState, useRef, useEffect } from "react";
import { Frame, Element, useEditor } from "@craftjs/core";
import { useProjectStore } from "../../../hooks/useProjectStore";
import { setViewport } from "../../../stores/projectStore";
import { CraftBlock } from "./CraftBlock";
import { blocksToSerializedNodes } from "./serialization";

/* ═══════════════════  Constants  ═══════════════════ */

const ARTBOARD_SIZES: Record<string, { w: number; h: number; label: string }> = {
    desktop: { w: 1440, h: 900, label: "Desktop" },
    tablet: { w: 768, h: 1024, label: "Tablet" },
    mobile: { w: 375, h: 812, label: "Mobile" },
};

/* ═══════════════════  CraftFrame  ═════════════════ */

export const CraftFrame: React.FC = () => {
    const { project, selectedPageId, selectedComponentId, viewport } = useProjectStore();
    const { actions } = useEditor();

    // Viewport measurement
    const [vpSize, setVpSize] = useState({ w: 0, h: 0 });
    const scrollRef = useRef<HTMLDivElement>(null);

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

    // ── Load blocks into craft.js when page changes ──
    useEffect(() => {
        if (!project || !selectedPageId) return;

        const page = project.pages.find((p) => p.id === selectedPageId && !p.archived);
        if (!page?.root_block_id) return;

        const activeBlocks = project.blocks.filter((b) => !b.archived);

        // Find blocks for this page (root + descendants)
        const pageBlocks = getPageBlocks(activeBlocks, page.root_block_id);

        if (pageBlocks.length === 0) return;

        const serialized = blocksToSerializedNodes(pageBlocks, page.root_block_id);

        try {
            actions.deserialize(serialized);
        } catch (err) {
            console.error("[CraftFrame] Failed to deserialize blocks:", err);
        }
    }, [project, selectedPageId, actions]);

    // ── Early returns ──
    if (!project) {
        return (
            <div className="h-full flex items-center justify-center bg-[var(--ide-bg)]">
                <p className="text-sm text-[var(--ide-text-secondary)]">Open or create a project to get started.</p>
            </div>
        );
    }

    return (
        <div className="h-full bg-[var(--ide-canvas-bg)] flex flex-col overflow-hidden">
            {/* Viewport Switcher */}
            <ViewportBar viewport={viewport} artW={artW} artH={artH} />

            {/* Scroll container */}
            <div ref={scrollRef} className="flex-1 overflow-auto">
                <div
                    className="min-h-full flex justify-center py-3 canvas-bg"
                >
                    {/* Artboard (white page) */}
                    <div
                        className="bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] transition-[width] duration-300"
                        style={{ width: artW, minHeight: artH }}
                    >
                        {/* Component editing banner */}
                        {selectedComponentId && (
                            <ComponentBanner
                                name={project.components?.find((c: any) => c.id === selectedComponentId)?.name}
                            />
                        )}

                        {/* craft.js Frame */}
                        <div className="relative p-4 min-h-[200px]">
                            <Frame>
                                <Element
                                    canvas
                                    is={CraftBlock}
                                    blockType="container"
                                    blockName="Page Root"
                                    blockId="ROOT"
                                    styles={{}}
                                    responsiveStyles={{}}
                                    properties={{}}
                                    bindings={{}}
                                    eventHandlers={[]}
                                    custom={{ isRoot: true }}
                                >
                                </Element>
                            </Frame>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════  Helpers  ═════════════════════ */

/**
 * Collect all blocks that belong to a page (root + all descendants).
 */
function getPageBlocks(allBlocks: any[], rootId: string): any[] {
    const result: any[] = [];
    const idSet = new Set<string>();

    function collect(blockId: string) {
        if (idSet.has(blockId)) return;
        const block = allBlocks.find((b: any) => b.id === blockId);
        if (!block) return;
        idSet.add(blockId);
        result.push(block);

        // Find children
        const children = allBlocks.filter((b: any) => b.parent_id === blockId);
        for (const child of children) {
            collect(child.id);
        }
    }

    collect(rootId);
    return result;
}

/* ═══════════════════  Sub-components  ══════════════ */

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
                    className={`h-6 px-3 text-[10px] font-semibold rounded transition-colors ${
                        viewport === key
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
            onClick={(e) => {
                e.stopPropagation();
                const { closeComponentEditor } = require("../../../stores/projectStore");
                closeComponentEditor();
            }}
            className="px-3 py-1 text-[10px] font-bold bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
        >
            Exit
        </button>
    </div>
);

export default CraftFrame;
