/**
 * Toolbar Component - VS Code Style Tab Bar
 * 
 * Simplified tab bar mimicking VS Code file tabs.
 * Clean, minimal, no over-design.
 */

import React, { useState } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { setActiveTab, closeProject } from "../../stores/projectStore";

const Toolbar: React.FC = () => {
    const { project, selectedPageId, activeTab } = useProjectStore();
    const [hoveredTab, setHoveredTab] = useState<string | null>(null);

    // Derive selectedPage from the project's pages array
    const selectedPage = project?.pages.find((p) => p.id === selectedPageId);

    // Mock open files for VS Code-like tabs
    const openTabs = [
        { id: "canvas", label: selectedPage?.name || "index.tsx", icon: "tsx" },
        { id: "logic", label: "logic.ts", icon: "ts" },
        { id: "api", label: "api.ts", icon: "ts" },
        { id: "erd", label: "schema.prisma", icon: "prisma" },
    ];

    const getFileIcon = (type: string) => {
        switch (type) {
            case "tsx":
                return <span className="text-[#519aba]">TS</span>;
            case "ts":
                return <span className="text-[#3178c6]">TS</span>;
            case "prisma":
                return <span className="text-[#5a67d8]">P</span>;
            default:
                return <span className="text-[#858585]">F</span>;
        }
    };

    return (
        <div className="h-full flex items-center bg-[#252526] overflow-x-auto">
            {/* Home / Back Button */}
            <button
                onClick={closeProject}
                className="h-full px-3 flex items-center text-[#858585] hover:text-white hover:bg-[#2d2d2d] transition-colors border-r border-[#1e1e1e]"
                title="Return to Dashboard"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
            </button>

            {/* File Tabs */}
            <div className="flex h-full">
                {openTabs.map((tab) => (
                    <button
                        key={tab.id}
                        className={`h-full px-4 flex items-center gap-2 text-xs border-r border-[#1e1e1e] transition-colors relative ${activeTab === tab.id
                            ? "bg-[#1e1e1e] text-white"
                            : "text-[#969696] hover:bg-[#2d2d2d]"
                            }`}
                        onClick={() => setActiveTab(tab.id as "canvas" | "logic" | "api" | "erd")}
                        onMouseEnter={() => setHoveredTab(tab.id)}
                        onMouseLeave={() => setHoveredTab(null)}
                    >
                        {/* File type icon placeholder */}
                        <span className="text-[10px] font-bold">{getFileIcon(tab.icon)}</span>

                        {/* File name */}
                        <span>{tab.label}</span>

                        {/* Close button on hover (optional VS Code feature) */}
                        {(hoveredTab === tab.id || activeTab === tab.id) && (
                            <span
                                className="ml-1 w-4 h-4 flex items-center justify-center rounded hover:bg-[#3c3c3c] text-[#858585] hover:text-white"
                                onClick={(e) => { e.stopPropagation(); }}
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </span>
                        )}

                        {/* Active tab indicator (top border like VS Code) */}
                        {activeTab === tab.id && (
                            <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#007acc]" />
                        )}
                    </button>
                ))}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Project name (right side, subtle) */}
            <div className="px-4 text-xs text-[#858585]">
                {project?.name || "Untitled"}
            </div>
        </div>
    );
};

export default Toolbar;
