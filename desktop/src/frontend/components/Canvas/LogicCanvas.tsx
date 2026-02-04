/**
 * LogicCanvas Component - React version
 * 
 * Visual node-based editor for logic flows.
 * Allows creating and connecting logic nodes for frontend events
 * and backend API handlers.
 */

import React, { useState } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { LogicNode } from "../../hooks/useTauri";

const LogicCanvas: React.FC = () => {
    const { project } = useProjectStore();
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);

    const flows = project?.logic_flows.filter(f => !f.archived) || [];
    const selectedFlow = flows.find(f => f.id === selectedFlowId);

    return (
        <div className="h-full flex">
            {/* Flow List Sidebar */}
            <div className="w-48 bg-ide-sidebar border-r border-ide-border flex-shrink-0">
                <div className="p-3 border-b border-ide-border">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-ide-text-muted">
                        Logic Flows
                    </h3>
                </div>
                <div className="p-2">
                    {flows.length > 0 ? (
                        flows.map((flow) => (
                            <button
                                key={flow.id}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedFlowId === flow.id
                                    ? "bg-ide-accent text-white"
                                    : "text-ide-text hover:bg-ide-panel"
                                    }`}
                                onClick={() => setSelectedFlowId(flow.id)}
                            >
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                    {flow.name}
                                </div>
                                <span className="text-xs text-ide-text-muted">
                                    {flow.context === "frontend" ? "Frontend" : "Backend"}
                                </span>
                            </button>
                        ))
                    ) : (
                        <p className="text-xs text-ide-text-muted p-2">
                            No logic flows yet
                        </p>
                    )}
                </div>
            </div>

            {/* Node Canvas */}
            <div className="flex-1 overflow-hidden">
                {!selectedFlow ? (
                    <EmptyLogicState />
                ) : (
                    <div className="h-full relative">
                        {/* Canvas Header */}
                        <div className="absolute top-0 left-0 right-0 h-10 bg-ide-bg/80 backdrop-blur border-b border-ide-border flex items-center px-4 z-10">
                            <span className="text-sm font-medium text-ide-text">{selectedFlow.name}</span>
                            <span className="mx-2 text-ide-text-muted">·</span>
                            <span className="text-xs text-ide-text-muted">{selectedFlow.nodes.length} nodes</span>
                        </div>

                        {/* Nodes Area */}
                        <div className="h-full pt-10 overflow-auto p-8 canvas-grid">
                            {selectedFlow.nodes.length > 0 ? (
                                selectedFlow.nodes.map((node) => (
                                    <LogicNodeCard
                                        key={node.id}
                                        node={node}
                                        selected={selectedNodeId === node.id}
                                        onSelect={() => setSelectedNodeId(node.id)}
                                    />
                                ))
                            ) : (
                                <div className="h-full flex items-center justify-center">
                                    <div className="text-center text-ide-text-muted">
                                        <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                        <p className="text-sm">Drop nodes to build your logic</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Node Palette */}
            <div className="w-56 bg-ide-sidebar border-l border-ide-border flex-shrink-0 overflow-auto">
                <div className="p-3 border-b border-ide-border">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-ide-text-muted">
                        Node Types
                    </h3>
                </div>
                <div className="p-2 space-y-1">
                    <NodePaletteSection title="Control Flow">
                        <NodePaletteItem icon="git-branch" name="Condition" />
                        <NodePaletteItem icon="repeat" name="Loop" />
                        <NodePaletteItem icon="clock" name="Delay" />
                    </NodePaletteSection>
                    <NodePaletteSection title="Data">
                        <NodePaletteItem icon="variable" name="Set Variable" />
                        <NodePaletteItem icon="transform" name="Transform" />
                    </NodePaletteSection>
                    <NodePaletteSection title="UI Actions">
                        <NodePaletteItem icon="navigation" name="Navigate" />
                        <NodePaletteItem icon="alert" name="Alert" />
                        <NodePaletteItem icon="modal" name="Modal" />
                    </NodePaletteSection>
                    <NodePaletteSection title="Database">
                        <NodePaletteItem icon="db-read" name="DB Read" />
                        <NodePaletteItem icon="db-write" name="DB Write" />
                        <NodePaletteItem icon="db-delete" name="DB Delete" />
                    </NodePaletteSection>
                    <NodePaletteSection title="Response">
                        <NodePaletteItem icon="return" name="Return" />
                        <NodePaletteItem icon="error" name="Throw Error" />
                    </NodePaletteSection>
                </div>
            </div>
        </div>
    );
};

// Logic Node Card Component
interface LogicNodeCardProps {
    node: LogicNode;
    selected: boolean;
    onSelect: () => void;
}

const LogicNodeCard: React.FC<LogicNodeCardProps> = ({ node, selected, onSelect }) => {
    const getNodeColor = (): string => {
        switch (node.node_type) {
            case "condition":
                return "from-yellow-500/20 to-orange-500/20 border-yellow-500/50";
            case "db_read":
            case "db_create":
            case "db_update":
            case "db_delete":
                return "from-green-500/20 to-emerald-500/20 border-green-500/50";
            case "return":
            case "throw_error":
                return "from-red-500/20 to-rose-500/20 border-red-500/50";
            case "navigate":
            case "alert":
            case "open_modal":
                return "from-blue-500/20 to-cyan-500/20 border-blue-500/50";
            default:
                return "from-purple-500/20 to-indigo-500/20 border-purple-500/50";
        }
    };

    return (
        <div
            className={`absolute w-48 rounded-lg border bg-gradient-to-br ${getNodeColor()} p-3 cursor-move transition-all hover:shadow-lg ${selected ? "ring-2 ring-ide-accent" : ""
                }`}
            style={{ left: `${node.position.x}px`, top: `${node.position.y}px` }}
            onClick={onSelect}
        >
            {/* Node Header */}
            <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                </div>
                <span className="text-sm font-medium text-white truncate">
                    {node.label || node.node_type}
                </span>
            </div>

            {/* Input Port */}
            <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-ide-accent border-2 border-ide-bg" />

            {/* Output Port */}
            <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-ide-success border-2 border-ide-bg" />
        </div>
    );
};

// Node Palette Section
interface NodePaletteSectionProps {
    title: string;
    children: React.ReactNode;
}

const NodePaletteSection: React.FC<NodePaletteSectionProps> = ({ title, children }) => {
    return (
        <div className="mb-3">
            <h4 className="text-[10px] uppercase tracking-wider text-ide-text-muted mb-1 px-2">
                {title}
            </h4>
            <div className="space-y-1">
                {children}
            </div>
        </div>
    );
};

// Node Palette Item
interface NodePaletteItemProps {
    icon: string;
    name: string;
}

const NodePaletteItem: React.FC<NodePaletteItemProps> = ({ icon, name }) => {
    return (
        <div
            className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab text-sm text-ide-text hover:bg-ide-panel transition-colors"
            draggable="true"
        >
            <div className="w-5 h-5 rounded bg-ide-accent/20 flex items-center justify-center">
                <svg className="w-3 h-3 text-ide-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            </div>
            {name}
        </div>
    );
};

// Empty State
const EmptyLogicState: React.FC = () => {
    return (
        <div className="h-full flex items-center justify-center bg-ide-bg">
            <div className="text-center max-w-sm">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
                    <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                </div>
                <h3 className="text-lg font-semibold text-ide-text mb-2">
                    Logic Flow Editor
                </h3>
                <p className="text-sm text-ide-text-muted mb-4">
                    Create visual logic flows for frontend events and backend API handlers
                </p>
                <button className="btn-primary">
                    Create Logic Flow
                </button>
            </div>
        </div>
    );
};

export default LogicCanvas;
