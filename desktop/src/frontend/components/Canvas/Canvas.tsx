/**
 * Canvas Component - React version
 * 
 * The main visual editing area where blocks are displayed and manipulated.
 */

import React from "react";
import {
    selectBlock,
    getBlockChildren,
    getRootBlocks,
    getPage,
    addBlock,
} from "../../stores/projectStore";
import { useProjectStore } from "../../hooks/useProjectStore";
import { BlockSchema } from "../../hooks/useTauri";
import { useToast } from "../../context/ToastContext";
import CodeEditor from "./CodeEditor";

const Canvas: React.FC = () => {
    const { project, selectedPageId, viewport, editMode } = useProjectStore();
    const toast = useToast();

    const selectedPage = project && selectedPageId ? getPage(selectedPageId) : null;
    const rootBlocks = getRootBlocks();

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        const blockType = e.dataTransfer.getData("application/grapes-block");
        if (blockType) {
            const name = `New ${blockType.charAt(0).toUpperCase() + blockType.slice(1)}`;
            await addBlock(blockType, name);
        }
    };

    if (!project) {
        return <WelcomeScreen />;
    }

    return (
        <div
            className="h-full bg-[var(--ide-canvas-bg)] flex flex-col relative overflow-hidden canvas-bg"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {editMode === "code" ? (
                <div className="flex-1 animate-fade-in">
                    <CodeEditor />
                </div>
            ) : !selectedPage ? (
                <div className="flex-1 flex flex-col items-center justify-center text-[var(--ide-text-muted)] animate-slide-up p-12">
                    <div className="w-24 h-24 rounded-3xl bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] flex items-center justify-center mb-6 shadow-2xl overflow-hidden relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <svg className="w-10 h-10 text-[var(--ide-text-muted)] group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-black text-white mb-2 tracking-tight">No Page Selected</h2>
                    <p className="text-[var(--ide-text-muted)] text-center max-w-sm mb-8 leading-relaxed">
                        Select a page from the explorer to start building your visual interface.
                    </p>
                    <button
                        onClick={() => toast.info("Open the Sidebar and pick a page!")}
                        className="btn-modern-secondary"
                    >
                        Browse Project
                    </button>
                </div>
            ) : (
                /* High-Fidelity Browser Preview Container */
                <div className="flex-1 overflow-auto p-4 lg:p-10 custom-scrollbar flex justify-center">
                    <div
                        className={`bg-white rounded-2xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] mx-auto transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)] border border-white/5 flex flex-col overflow-hidden relative animate-slide-up ${viewport === 'desktop' ? 'w-full min-h-[800px]' :
                                viewport === 'tablet' ? 'w-[768px] min-h-[1024px]' :
                                    'w-[375px] min-h-[667px]'
                            }`}
                    >
                        {/* Browser Chrome (High Parity) */}
                        <div className="bg-[#f1f3f4] h-10 px-4 flex items-center gap-4 shrink-0 select-none">
                            <div className="flex gap-1.5 shrink-0">
                                <div className="w-3 h-3 rounded-full bg-[#ff5f57] ring-1 ring-black/5" />
                                <div className="w-3 h-3 rounded-full bg-[#ffbd2e] ring-1 ring-black/5" />
                                <div className="w-3 h-3 rounded-full bg-[#28c840] ring-1 ring-black/5" />
                            </div>
                            <div className="flex-1 flex justify-center">
                                <div className="bg-white/80 backdrop-blur-md h-7 max-w-lg w-full rounded-full border border-black/5 flex items-center px-4 gap-2 shadow-sm">
                                    <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                    <span className="text-[10px] text-slate-500 font-medium truncate">
                                        localhost:3000{selectedPage.path || "/"}
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <div className="w-4 h-4 rounded-md bg-slate-200" />
                                <div className="w-4 h-4 rounded-md bg-slate-200" />
                            </div>
                        </div>

                        {/* Visual Canvas Content */}
                        <div className="flex-1 p-0 overflow-auto bg-white">
                            {rootBlocks.length > 0 ? (
                                <div className="animate-fade-in">
                                    {rootBlocks.map((block) => (
                                        <BlockRenderer key={block.id} block={block} />
                                    ))}
                                </div>
                            ) : (
                                <div className="h-[500px] m-4 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 group cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/10 transition-all duration-300">
                                    <div className="text-center group-hover:scale-110 transition-transform">
                                        <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-4 shadow-sm">
                                            <svg className="w-8 h-8 text-slate-300 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                            </svg>
                                        </div>
                                        <p className="font-bold text-slate-600">Start Designing</p>
                                        <p className="text-xs text-slate-400 mt-1">Drag and drop blocks here</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Block Renderer Component
interface BlockRendererProps {
    block: BlockSchema;
}

const BlockRenderer: React.FC<BlockRendererProps> = ({ block }) => {
    const { selectedBlockId } = useProjectStore();
    const isSelected = selectedBlockId === block.id;
    const children = getBlockChildren(block.id);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        selectBlock(block.id);
    };

    // Get block styles
    const getTypeClasses = (blockType: string): string => {
        switch (blockType) {
            case "container":
                return "p-4 bg-slate-50 rounded-lg min-h-[100px]";
            case "section":
                return "p-6 bg-slate-100 rounded-lg";
            case "text":
            case "paragraph":
                return "p-2";
            case "heading":
                return "p-2 text-2xl font-bold";
            case "button":
                return "px-4 py-2 bg-indigo-600 text-white rounded-lg inline-block hover:bg-indigo-500";
            case "image":
                return "bg-slate-200 rounded-lg min-h-[100px] flex items-center justify-center";
            case "input":
                return "border border-slate-300 rounded-lg px-3 py-2 bg-white";
            case "form":
                return "p-4 bg-slate-50 rounded-lg border border-slate-200";
            case "card":
                return "p-4 bg-white rounded-lg shadow-md";
            default:
                return "p-2 bg-slate-50 rounded min-h-[40px]";
        }
    };

    const blockClasses = `block-hover cursor-pointer transition-all ${isSelected ? "outline outline-2 outline-indigo-500 outline-offset-2" : ""
        } ${getTypeClasses(block.block_type)}`;

    // Render block content based on type
    const renderContent = () => {
        const text = block.properties.text as string | undefined;

        switch (block.block_type) {
            case "text":
            case "paragraph":
                return <p className="text-slate-700">{text || "Text content..."}</p>;
            case "heading":
                return <h2 className="text-slate-900">{text || "Heading"}</h2>;
            case "button":
                return <span>{text || "Button"}</span>;
            case "image":
                return (
                    <div className="text-slate-400 text-center">
                        <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs">Image</span>
                    </div>
                );
            case "input":
                return (
                    <input
                        type="text"
                        placeholder={text || "Input..."}
                        className="w-full outline-none bg-transparent"
                        disabled
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div
            className={blockClasses}
            onClick={handleClick}
            data-block-id={block.id}
            style={{ position: 'relative' }}
        >
            {/* Block Label (shown when selected) */}
            {isSelected && (
                <div className="absolute -top-6 left-0 bg-indigo-500 text-white text-xs px-2 py-0.5 rounded z-10">
                    {block.name || block.block_type}
                </div>
            )}

            {/* Block Content */}
            {renderContent()}

            {/* Render Children */}
            {children.length > 0 && (
                <div className="space-y-2">
                    {children.map((child) => (
                        <BlockRenderer key={child.id} block={child} />
                    ))}
                </div>
            )}
        </div>
    );
};

// Welcome Screen Component
const WelcomeScreen: React.FC = () => {
    const toast = useToast();
    return (
        <div className="h-full flex items-center justify-center p-12 bg-[#050508]">
            <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center animate-fade-up">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-widest mb-6">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                        Beta v0.1.0 Ready
                    </div>
                    <h1 className="text-5xl font-black text-white leading-tight mb-4 tracking-tighter">
                        Build software at the <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">speed of thought.</span>
                    </h1>
                    <p className="text-lg text-ide-text-muted mb-8 leading-relaxed">
                        Grapes is the visual engineering platform for high-performance React applications,
                        NestJS services, and complex database schemas.
                    </p>
                    <div className="flex flex-wrap gap-4">
                        <button
                            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center gap-2"
                            onClick={() => toast.info("Use the top-left 'New' button to start!")}
                        >
                            Get Started
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                        </button>
                        <button className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl border border-white/10 transition-all backdrop-blur-md active:scale-95">
                            Read Docs
                        </button>
                    </div>
                </div>

                <div className="relative">
                    <div className="absolute inset-0 bg-indigo-500/20 blur-[120px] rounded-full"></div>
                    <div className="relative glass rounded-2xl border border-white/10 p-2 shadow-2xl overflow-hidden aspect-video group">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent pointer-events-none"></div>
                        <div className="h-full w-full bg-[#0d0d14] rounded-xl flex flex-col p-4">
                            <div className="flex items-center gap-1.5 mb-4">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
                            </div>
                            <div className="flex-1 flex flex-col gap-2">
                                <div className="w-2/3 h-4 bg-white/5 rounded"></div>
                                <div className="w-full h-32 bg-white/5 rounded-lg border border-white/5 flex items-center justify-center">
                                    <svg className="w-12 h-12 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div className="grid grid-cols-3 gap-2 mt-2">
                                    <div className="h-12 bg-white/5 rounded border border-white/5"></div>
                                    <div className="h-12 bg-white/5 rounded border border-white/5"></div>
                                    <div className="h-12 bg-white/5 rounded border border-white/5"></div>
                                </div>
                            </div>
                        </div>
                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                            <p className="text-white font-bold text-sm bg-indigo-600 px-4 py-2 rounded-full shadow-xl">Start Building Now</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Canvas;
