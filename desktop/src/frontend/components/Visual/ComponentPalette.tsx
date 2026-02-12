/**
 * Component Palette - Visual Mode Sidebar
 * 
 * Replaces the file tree when in visual editing mode.
 * Provides drag-and-drop components for building UIs.
 */

import React, { useState } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { createMasterComponent } from "../../stores/projectStore";

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
    const { project } = useProjectStore();
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
        new Set(["Components", "Layout", "Typography", "Forms", "Media"])
    );
    const [isCreatingComponent, setIsCreatingComponent] = useState(false);
    const [newComponentName, setNewComponentName] = useState("");

    const toggleCategory = (categoryName: string) => {
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(categoryName)) {
            newExpanded.delete(categoryName);
        } else {
            newExpanded.add(categoryName);
        }
        setExpandedCategories(newExpanded);
    };

    const handleDragStart = (e: React.DragEvent, componentType: string, componentId?: string) => {
        e.dataTransfer.setData("application/akasha-block", componentType);
        if (componentId) {
            e.dataTransfer.setData("application/akasha-component-id", componentId);
        }
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

    const handleCreateComponent = async () => {
        if (!newComponentName.trim()) return;
        try {
            await createMasterComponent(newComponentName);
            setNewComponentName("");
            setIsCreatingComponent(false);
        } catch (err) {
            console.error("Failed to create component:", err);
        }
    };

    // Build dynamic library including components
    const dynamicLibrary = [
        {
            name: "Components",
            items: [
                ...(project?.components.filter(c => !c.archived).map(c => ({
                    type: "instance",
                    name: c.name,
                    icon: "🧩",
                    description: "Reusable component",
                    id: c.id
                })) || [])
            ]
        },
        ...COMPONENT_LIBRARY
    ];

    const filteredLibrary = dynamicLibrary.map(category => ({
        ...category,
        items: category.items.filter(item =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
    })).filter(category => category.items.length > 0 || category.name === "Components");

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
                        type="search"
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
                {filteredLibrary.map((category) => (
                    <div key={category.name} className="mb-6 animate-fade-in">
                        {/* Category Header */}
                        <div className="flex items-center justify-between mb-2">
                            <button
                                onClick={() => toggleCategory(category.name)}
                                className="flex items-center gap-2 group w-full"
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

                            {/* Create Component Logic */}
                            {category.name === "Components" && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setIsCreatingComponent(!isCreatingComponent); }}
                                    className="text-[var(--ide-text-muted)] hover:text-indigo-400 p-1"
                                    title="Create Component"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Create Component Input */}
                        {category.name === "Components" && isCreatingComponent && expandedCategories.has("Components") && (
                            <div className="mb-3 px-1">
                                <form
                                    onSubmit={(e) => { e.preventDefault(); handleCreateComponent(); }}
                                    className="flex items-center gap-2"
                                >
                                    <input
                                        type="text"
                                        autoFocus
                                        placeholder="Name..."
                                        value={newComponentName}
                                        onChange={e => setNewComponentName(e.target.value)}
                                        className="w-full text-xs bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded px-2 py-1 text-[var(--ide-text)]"
                                    />
                                    <button type="submit" className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700">Add</button>
                                </form>
                            </div>
                        )}

                        {/* Category Items: Grid View */}
                        {expandedCategories.has(category.name) && (
                            <div className="grid grid-cols-2 gap-2">
                                {category.items.map((item) => (
                                    <div
                                        key={item.name + (item as any).id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, item.type, (item as any).id)}
                                        className="group relative h-20 bg-[var(--ide-bg-panel)] hover:bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] hover:border-indigo-500/30 rounded-xl cursor-grab transition-all duration-300 flex flex-col items-center justify-center gap-2 overflow-hidden shadow-sm"
                                        title={item.description}
                                    >
                                        <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 blur-xl transition-opacity pointer-events-none" />
                                        <div className="relative transform group-hover:scale-110 transition-transform duration-300">
                                            <span className="text-xl filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{item.icon}</span>
                                        </div>
                                        <div className="relative text-[10px] text-[var(--ide-text-secondary)] font-bold tracking-tight group-hover:text-[var(--ide-text)] transition-colors text-center px-1 truncate w-full">
                                            {item.name}
                                        </div>

                                        {/* Edit Button for Components */}
                                        {category.name === "Components" && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    // Import dynamically or cast to any to avoid circular deps if needed
                                                    // But createMasterComponent is imported. selectComponent needs import.
                                                    const { selectComponent } = require("../../stores/projectStore");
                                                    selectComponent((item as any).id);
                                                }}
                                                className="absolute top-1 right-1 p-1 bg-white/10 hover:bg-white/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Edit Master Component"
                                            >
                                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {category.name === "Components" && category.items.length === 0 && !isCreatingComponent && (
                                    <div className="col-span-2 text-center text-[10px] text-[var(--ide-text-muted)] italic py-2">
                                        No components created yet
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
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
