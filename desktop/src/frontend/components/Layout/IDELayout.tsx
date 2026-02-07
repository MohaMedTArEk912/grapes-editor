/**
 * IDE Layout Component - VS Code Style
 * 
 * Simplified VS Code-like layout:
 * - Top title bar
 * - Left Activity Bar (icon strip)
 * - Left Explorer Panel
 * - Main Editor Area with file tabs
 * - Bottom Status Bar
 */

import React, { useState } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";

interface IDELayoutProps {
    toolbar: React.ReactNode;
    fileTree: React.ReactNode;
    canvas: React.ReactNode;
    inspector?: React.ReactNode;
    terminal?: React.ReactNode;
}

/**
 * Main IDE Layout - Mimics VS Code structure
 */
const IDELayout: React.FC<IDELayoutProps> = ({
    toolbar,
    fileTree,
    canvas,
    terminal
}) => {
    const { project } = useProjectStore();

    // Sidebar state
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [activeActivity, setActiveActivity] = useState<"explorer" | "search" | "git" | "extensions">("explorer");
    const [terminalOpen, setTerminalOpen] = useState(false);

    // Toggle sidebar via activity bar
    const handleActivityClick = (activity: typeof activeActivity) => {
        if (activeActivity === activity && sidebarOpen) {
            setSidebarOpen(false);
        } else {
            setActiveActivity(activity);
            setSidebarOpen(true);
        }
    };

    return (
        <div className="h-screen w-screen flex flex-col bg-[#1e1e1e] text-[#cccccc] overflow-hidden">

            {/* ===== TOP: Title Bar ===== */}
            <header className="h-9 bg-[#323233] border-b border-[#252526] flex items-center px-4 select-none flex-shrink-0">
                <span className="text-xs text-[#cccccc]/80 font-medium">
                    {project?.name || "Untitled"} — Grapes IDE
                </span>
            </header>

            {/* ===== MAIN CONTENT AREA ===== */}
            <div className="flex-1 flex overflow-hidden">

                {/* ===== LEFT: Activity Bar (Icon Strip) ===== */}
                <aside className="w-12 bg-[#333333] flex flex-col items-center py-2 flex-shrink-0">
                    <ActivityIcon
                        icon="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        label="Explorer"
                        active={activeActivity === "explorer" && sidebarOpen}
                        onClick={() => handleActivityClick("explorer")}
                    />
                    <ActivityIcon
                        icon="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        label="Search"
                        active={activeActivity === "search" && sidebarOpen}
                        onClick={() => handleActivityClick("search")}
                    />
                    <ActivityIcon
                        icon="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                        label="Source Control"
                        active={activeActivity === "git" && sidebarOpen}
                        onClick={() => handleActivityClick("git")}
                    />
                    <ActivityIcon
                        icon="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"
                        label="Extensions"
                        active={activeActivity === "extensions" && sidebarOpen}
                        onClick={() => handleActivityClick("extensions")}
                    />

                    {/* Spacer pushes settings to bottom */}
                    <div className="flex-1" />

                    <ActivityIcon
                        icon="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        label="Settings"
                        active={false}
                        onClick={() => { }}
                    />
                </aside>

                {/* ===== LEFT: Explorer Panel ===== */}
                {sidebarOpen && (
                    <aside className="w-60 bg-[#252526] border-r border-[#1e1e1e] flex flex-col flex-shrink-0">
                        {/* Panel Header */}
                        <div className="h-9 px-4 flex items-center border-b border-[#1e1e1e]">
                            <span className="text-[11px] font-semibold text-[#bbbbbb] uppercase tracking-wider">
                                {activeActivity === "explorer" && "Explorer"}
                                {activeActivity === "search" && "Search"}
                                {activeActivity === "git" && "Source Control"}
                                {activeActivity === "extensions" && "Extensions"}
                            </span>
                        </div>

                        {/* Panel Content */}
                        <div className="flex-1 overflow-y-auto overflow-x-hidden">
                            {activeActivity === "explorer" && fileTree}
                            {activeActivity === "search" && (
                                <div className="p-4 text-xs text-[#808080]">Search functionality</div>
                            )}
                            {activeActivity === "git" && (
                                <div className="p-4 text-xs text-[#808080]">No source control providers</div>
                            )}
                            {activeActivity === "extensions" && (
                                <div className="p-4 text-xs text-[#808080]">Extensions list</div>
                            )}
                        </div>
                    </aside>
                )}

                {/* ===== CENTER: Editor Area ===== */}
                <main className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]">
                    {/* Toolbar / Tab Bar */}
                    <div className="h-9 bg-[#252526] border-b border-[#1e1e1e] flex items-center flex-shrink-0">
                        {toolbar}
                    </div>

                    {/* Editor Content */}
                    <div className={`flex-1 overflow-auto ${terminalOpen ? 'h-[60%]' : ''}`}>
                        {canvas}
                    </div>

                    {/* Terminal Panel (toggleable) */}
                    {terminalOpen && terminal && (
                        <div className="h-[35%] border-t border-[#1e1e1e] bg-[#1e1e1e]">
                            <div className="h-8 bg-[#252526] px-4 flex items-center gap-4 text-xs border-b border-[#1e1e1e]">
                                <span className="text-[#cccccc] font-medium">Terminal</span>
                            </div>
                            <div className="h-[calc(100%-2rem)] overflow-auto">
                                {terminal}
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* ===== BOTTOM: Status Bar ===== */}
            <footer className="h-6 bg-[#007acc] flex items-center px-3 text-[11px] text-white select-none flex-shrink-0">
                {/* Left side */}
                <div className="flex items-center gap-4">
                    <span>{project?.name || "No Project"}</span>
                </div>

                {/* Right side */}
                <div className="ml-auto flex items-center gap-4">
                    <span>Ln 1, Col 1</span>
                    <span>UTF-8</span>
                    <span>TypeScript React</span>
                    <button
                        onClick={() => setTerminalOpen(!terminalOpen)}
                        className="hover:bg-white/20 px-2 py-0.5 rounded transition-colors"
                    >
                        Terminal
                    </button>
                </div>
            </footer>
        </div>
    );
};

/* ===== Activity Icon Component ===== */
interface ActivityIconProps {
    icon: string;
    label: string;
    active: boolean;
    onClick: () => void;
}

const ActivityIcon: React.FC<ActivityIconProps> = ({ icon, label, active, onClick }) => (
    <button
        className={`w-12 h-12 flex items-center justify-center relative group transition-colors ${active ? "text-white" : "text-[#858585] hover:text-white"
            }`}
        onClick={onClick}
        title={label}
        aria-label={label}
    >
        {/* Active indicator bar */}
        {active && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-white" />
        )}
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={icon} />
        </svg>
    </button>
);

export default IDELayout;
