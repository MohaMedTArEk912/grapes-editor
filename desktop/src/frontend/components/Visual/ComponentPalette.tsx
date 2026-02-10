/**
 * Component Palette - Visual Mode Sidebar
 * 
 * Replaces the file tree when in visual editing mode.
 * Provides drag-and-drop components for building UIs.
 */

import React, { useState } from "react";

interface ComponentItem {
    type: string;
    name: string;
    icon: string;
    description: string;
}

interface ComponentCategory {
    name: string;
    items: ComponentItem[];
}

const COMPONENT_LIBRARY: ComponentCategory[] = [
    {
        name: "Layout",
        items: [
            { type: "container", name: "Container", icon: "📦", description: "Flexible container" },
            { type: "section", name: "Section", icon: "📄", description: "Page section" },
            { type: "card", name: "Card", icon: "🃏", description: "Card component" },
        ]
    },
    {
        name: "Typography",
        items: [
            { type: "heading", name: "Heading", icon: "📝", description: "H1-H6 heading" },
            { type: "paragraph", name: "Paragraph", icon: "📃", description: "Text paragraph" },
            { type: "text", name: "Text", icon: "✏️", description: "Inline text" },
        ]
    },
    {
        name: "Forms",
        items: [
            { type: "button", name: "Button", icon: "🔘", description: "Interactive button" },
            { type: "input", name: "Input", icon: "📝", description: "Text input field" },
            { type: "form", name: "Form", icon: "📋", description: "Form container" },
        ]
    },
    {
        name: "Media",
        items: [
            { type: "image", name: "Image", icon: "🖼️", description: "Image element" },
        ]
    }
];

const ComponentPalette: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
        new Set()
    );

    const toggleCategory = (categoryName: string) => {
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(categoryName)) {
            newExpanded.delete(categoryName);
        } else {
            newExpanded.add(categoryName);
        }
        setExpandedCategories(newExpanded);
    };

    const handleDragStart = (e: React.DragEvent, componentType: string) => {
        e.dataTransfer.setData("application/akasha-block", componentType);
        e.dataTransfer.setData("text/akasha-block", componentType);
        e.dataTransfer.setData("text/plain", componentType);
        e.dataTransfer.effectAllowed = "copy";

        // Add a ghost image or styling if needed
        const ghost = document.createElement('div');
        ghost.className = 'px-3 py-1.5 rounded-lg text-xs font-bold shadow-2xl';
        ghost.style.background = "linear-gradient(135deg, var(--ide-primary), var(--ide-primary-hover))";
        ghost.style.color = "#ffffff";
        ghost.innerText = componentType.toUpperCase();
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 0, 0);
        setTimeout(() => document.body.removeChild(ghost), 0);
    };

    const filteredLibrary = COMPONENT_LIBRARY.map(category => ({
        ...category,
        items: category.items.filter(item =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
    })).filter(category => category.items.length > 0);

    return (
        <div className="w-64 bg-[var(--ide-bg-sidebar)] border-r border-[var(--ide-border)] flex flex-col h-full">
            {/* Search Section */}
            <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[var(--ide-text-secondary)] font-bold uppercase tracking-[0.2em]">Components</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                </div>
                <div className="relative group">
                    <input
                        type="text"
                        placeholder="Quick search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[var(--ide-bg-panel)] text-[var(--ide-text)] text-[11px] pl-8 pr-3 py-2 rounded-lg border border-[var(--ide-border)] focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-[var(--ide-text-muted)]"
                    />
                    <svg className="absolute left-2.5 top-2.5 w-3 h-3 text-[var(--ide-text-muted)] group-focus-within:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
            </div>

            {/* Component List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4">
                {filteredLibrary.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 opacity-40">
                        <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <span className="text-xs">No matches</span>
                    </div>
                ) : (
                    filteredLibrary.map((category) => (
                        <div key={category.name} className="mb-6 animate-fade-in">
                            {/* Category Header */}
                            <button
                                onClick={() => toggleCategory(category.name)}
                                className="w-full py-2 flex items-center gap-2 group mb-2"
                            >
                                <svg
                                    className={`w-2.5 h-2.5 text-[var(--ide-text-muted)] group-hover:text-indigo-400 transition-all ${expandedCategories.has(category.name) ? 'rotate-90' : ''}`}
                                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
                                </svg>
                                <span className="text-[10px] text-[var(--ide-text-secondary)] font-bold uppercase tracking-widest leading-none group-hover:text-[var(--ide-text)] transition-colors">
                                    {category.name}
                                </span>
                            </button>

                            {/* Category Items: Grid View */}
                            {expandedCategories.has(category.name) && (
                                <div className="grid grid-cols-2 gap-2">
                                    {category.items.map((item) => (
                                        <div
                                            key={item.type}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, item.type)}
                                            className="group relative h-20 bg-[var(--ide-bg-panel)] hover:bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] hover:border-indigo-500/30 rounded-xl cursor-grab transition-all duration-300 flex flex-col items-center justify-center gap-2 overflow-hidden shadow-sm"
                                            title={item.description}
                                        >
                                            {/* Hover Glow */}
                                            <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 blur-xl transition-opacity pointer-events-none" />

                                            <div className="relative transform group-hover:scale-110 transition-transform duration-300">
                                                <span className="text-xl filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{item.icon}</span>
                                            </div>
                                            <div className="relative text-[10px] text-[var(--ide-text-secondary)] font-bold tracking-tight group-hover:text-[var(--ide-text)] transition-colors">
                                                {item.name}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Premium Hint */}
            <div className="p-4 bg-[var(--ide-bg-elevated)] border-t border-[var(--ide-border)]">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/5 border border-indigo-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    <p className="text-[9px] text-indigo-500/70 font-medium uppercase tracking-tighter">
                        Drag to create blocks
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ComponentPalette;
