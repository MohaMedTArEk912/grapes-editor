/**
 * Inspector Component - React version
 * 
 * Properties panel for the selected block/entity.
 */

import React from "react";
import {
    updateBlockProperty,
    updateBlockStyle,
    archiveBlock,
} from "../../stores/projectStore";
import { useProjectStore } from "../../hooks/useProjectStore";
import { BlockSchema } from "../../hooks/useTauri";

const Inspector: React.FC = () => {
    const { project, selectedBlockId } = useProjectStore();

    const selectedBlock = project?.blocks.find(b => b.id === selectedBlockId && !b.archived);

    if (!selectedBlock) {
        return <NoSelection />;
    }

    return (
        <div className="p-4">
            {/* Block Info Header */}
            <div className="mb-4">
                <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-ide-text-muted">
                        {selectedBlock.block_type}
                    </span>
                    <button
                        className="text-ide-error hover:bg-ide-error/20 p-1 rounded transition-colors"
                        onClick={() => archiveBlock(selectedBlock.id)}
                        aria-label="Delete block"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
                <h3 className="text-lg font-semibold text-ide-text mt-1">
                    {selectedBlock.name}
                </h3>
            </div>

            {/* Sections */}
            <InspectorSection title="Properties">
                <PropertyEditor block={selectedBlock} />
            </InspectorSection>

            <InspectorSection title="Layout">
                <LayoutEditor block={selectedBlock} />
            </InspectorSection>

            <InspectorSection title="Typography">
                <TypographyEditor block={selectedBlock} />
            </InspectorSection>

            <InspectorSection title="Spacing">
                <SpacingEditor block={selectedBlock} />
            </InspectorSection>
        </div>
    );
};

// No Selection Placeholder
const NoSelection: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center h-64 text-center text-ide-text-muted">
            <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
            <p className="text-sm">Select a block to edit</p>
            <p className="text-xs mt-1">Click on any element in the canvas</p>
        </div>
    );
};

// Inspector Section Component
interface InspectorSectionProps {
    title: string;
    children: React.ReactNode;
}

const InspectorSection: React.FC<InspectorSectionProps> = ({ title, children }) => {
    return (
        <div className="mb-4 border-t border-ide-border pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ide-text-muted mb-3">
                {title}
            </h4>
            {children}
        </div>
    );
};

// Property Editor
interface EditorProps {
    block: BlockSchema;
}

const PropertyEditor: React.FC<EditorProps> = ({ block }) => {
    const handleTextChange = async (value: string) => {
        await updateBlockProperty(block.id, "text", value);
    };

    const handlePropertySave = async (property: string, value: string) => {
        await updateBlockProperty(block.id, property, value);
    };

    return (
        <div className="space-y-3">
            {/* Name/Label */}
            <div>
                <label className="block text-xs text-ide-text-muted mb-1">Name</label>
                <input
                    type="text"
                    value={block.name}
                    className="input w-full text-sm"
                    disabled
                />
            </div>

            {/* Text Content (for text-based blocks) */}
            {["text", "paragraph", "heading", "button"].includes(block.block_type) && (
                <div>
                    <label className="block text-xs text-ide-text-muted mb-1">Text Content</label>
                    <textarea
                        key={`text-${block.id}`}
                        defaultValue={(block.properties.text as string) || ""}
                        onBlur={(e) => handleTextChange(e.target.value)}
                        className="input w-full text-sm resize-none"
                        rows={3}
                    />
                </div>
            )}

            {/* Placeholder (for inputs) */}
            {block.block_type === "input" && (
                <div>
                    <label className="block text-xs text-ide-text-muted mb-1">Placeholder</label>
                    <input
                        type="text"
                        key={`placeholder-${block.id}`}
                        defaultValue={(block.properties.placeholder as string) || ""}
                        onBlur={(e) => handlePropertySave("placeholder", e.target.value)}
                        className="input w-full text-sm"
                    />
                </div>
            )}

            {/* Textarea placeholder */}
            {block.block_type === "textarea" && (
                <div>
                    <label className="block text-xs text-ide-text-muted mb-1">Placeholder</label>
                    <input
                        type="text"
                        key={`placeholder-${block.id}`}
                        defaultValue={(block.properties.placeholder as string) || ""}
                        onBlur={(e) => handlePropertySave("placeholder", e.target.value)}
                        className="input w-full text-sm"
                    />
                </div>
            )}

            {/* Select options */}
            {block.block_type === "select" && (
                <div>
                    <label className="block text-xs text-ide-text-muted mb-1">Options (comma-separated)</label>
                    <input
                        type="text"
                        key={`options-${block.id}`}
                        defaultValue={(block.properties.options as string) || ""}
                        onBlur={(e) => handlePropertySave("options", e.target.value)}
                        placeholder="Option 1, Option 2, Option 3"
                        className="input w-full text-sm"
                    />
                </div>
            )}

            {/* Checkbox label */}
            {block.block_type === "checkbox" && (
                <div>
                    <label className="block text-xs text-ide-text-muted mb-1">Label</label>
                    <input
                        type="text"
                        key={`text-${block.id}`}
                        defaultValue={(block.properties.text as string) || ""}
                        onBlur={(e) => handleTextChange(e.target.value)}
                        className="input w-full text-sm"
                    />
                </div>
            )}

            {/* Image properties */}
            {block.block_type === "image" && (
                <>
                    <div>
                        <label className="block text-xs text-ide-text-muted mb-1">Image URL</label>
                        <input
                            type="text"
                            key={`src-${block.id}`}
                            defaultValue={(block.properties.src as string) || ""}
                            onBlur={(e) => handlePropertySave("src", e.target.value)}
                            placeholder="https://example.com/image.png"
                            className="input w-full text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-ide-text-muted mb-1">Alt Text</label>
                        <input
                            type="text"
                            key={`alt-${block.id}`}
                            defaultValue={(block.properties.alt as string) || ""}
                            onBlur={(e) => handlePropertySave("alt", e.target.value)}
                            placeholder="Descriptive text"
                            className="input w-full text-sm"
                        />
                    </div>
                </>
            )}

            {/* Video properties */}
            {block.block_type === "video" && (
                <div>
                    <label className="block text-xs text-ide-text-muted mb-1">Video URL</label>
                    <input
                        type="text"
                        key={`src-${block.id}`}
                        defaultValue={(block.properties.src as string) || ""}
                        onBlur={(e) => handlePropertySave("src", e.target.value)}
                        placeholder="https://example.com/video.mp4"
                        className="input w-full text-sm"
                    />
                </div>
            )}

            {/* Link properties */}
            {block.block_type === "link" && (
                <>
                    <div>
                        <label className="block text-xs text-ide-text-muted mb-1">Link Text</label>
                        <input
                            type="text"
                            key={`text-${block.id}`}
                            defaultValue={(block.properties.text as string) || ""}
                            onBlur={(e) => handleTextChange(e.target.value)}
                            className="input w-full text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-ide-text-muted mb-1">URL</label>
                        <input
                            type="text"
                            key={`href-${block.id}`}
                            defaultValue={(block.properties.href as string) || ""}
                            onBlur={(e) => handlePropertySave("href", e.target.value)}
                            placeholder="https://..."
                            className="input w-full text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-ide-text-muted mb-1">Target</label>
                        <select
                            key={`target-${block.id}`}
                            defaultValue={(block.properties.target as string) || "_self"}
                            onChange={(e) => handlePropertySave("target", e.target.value)}
                            className="input w-full text-sm"
                        >
                            <option value="_self">Same Window</option>
                            <option value="_blank">New Tab</option>
                        </select>
                    </div>
                </>
            )}

            {/* Form properties */}
            {block.block_type === "form" && (
                <>
                    <div>
                        <label className="block text-xs text-ide-text-muted mb-1">Action URL</label>
                        <input
                            type="text"
                            key={`action-${block.id}`}
                            defaultValue={(block.properties.action as string) || ""}
                            onBlur={(e) => handlePropertySave("action", e.target.value)}
                            placeholder="/api/submit"
                            className="input w-full text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-ide-text-muted mb-1">Method</label>
                        <select
                            key={`method-${block.id}`}
                            defaultValue={(block.properties.method as string) || "POST"}
                            onChange={(e) => handlePropertySave("method", e.target.value)}
                            className="input w-full text-sm"
                        >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="PATCH">PATCH</option>
                            <option value="DELETE">DELETE</option>
                        </select>
                    </div>
                </>
            )}
        </div>
    );
};

// Layout Editor
const LayoutEditor: React.FC<EditorProps> = ({ block }) => {
    const handleDisplayChange = async (value: string) => {
        await updateBlockStyle(block.id, "display", value);
    };

    return (
        <div className="space-y-3">
            <div>
                <label className="block text-xs text-ide-text-muted mb-1">Display</label>
                <select
                    className="input w-full text-sm"
                    key={`display-${block.id}`}
                    defaultValue={(block.styles.display as string) || "block"}
                    onChange={(e) => handleDisplayChange(e.target.value)}
                >
                    <option value="block">Block</option>
                    <option value="flex">Flex</option>
                    <option value="grid">Grid</option>
                    <option value="inline">Inline</option>
                    <option value="inline-block">Inline Block</option>
                    <option value="none">Hidden</option>
                </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="block text-xs text-ide-text-muted mb-1">Width</label>
                    <input
                        type="text"
                        placeholder="auto"
                        key={`width-${block.id}`}
                        defaultValue={(block.styles.width as string) || ""}
                        onBlur={(e) => updateBlockStyle(block.id, "width", e.target.value)}
                        className="input w-full text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs text-ide-text-muted mb-1">Height</label>
                    <input
                        type="text"
                        placeholder="auto"
                        key={`height-${block.id}`}
                        defaultValue={(block.styles.height as string) || ""}
                        onBlur={(e) => updateBlockStyle(block.id, "height", e.target.value)}
                        className="input w-full text-sm"
                    />
                </div>
            </div>
        </div>
    );
};

// Typography Editor
const TypographyEditor: React.FC<EditorProps> = ({ block }) => {
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="block text-xs text-ide-text-muted mb-1">Font Size</label>
                    <select
                        className="input w-full text-sm"
                        key={`font-size-${block.id}`}
                        defaultValue={(block.styles["font-size"] as string) || "16px"}
                        onChange={(e) => updateBlockStyle(block.id, "font-size", e.target.value)}
                    >
                        <option value="12px">12px</option>
                        <option value="14px">14px</option>
                        <option value="16px">16px</option>
                        <option value="18px">18px</option>
                        <option value="20px">20px</option>
                        <option value="24px">24px</option>
                        <option value="32px">32px</option>
                        <option value="48px">48px</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-ide-text-muted mb-1">Weight</label>
                    <select
                        className="input w-full text-sm"
                        key={`font-weight-${block.id}`}
                        defaultValue={(block.styles["font-weight"] as string) || "400"}
                        onChange={(e) => updateBlockStyle(block.id, "font-weight", e.target.value)}
                    >
                        <option value="300">Light</option>
                        <option value="400">Normal</option>
                        <option value="500">Medium</option>
                        <option value="600">Semibold</option>
                        <option value="700">Bold</option>
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-xs text-ide-text-muted mb-1">Text Color</label>
                <div className="flex gap-2">
                    <input
                        type="color"
                        key={`color-picker-${block.id}`}
                        defaultValue={(block.styles.color as string) || "#1e293b"}
                        onChange={(e) => updateBlockStyle(block.id, "color", e.target.value)}
                        className="w-10 h-8 rounded border border-ide-border cursor-pointer"
                    />
                    <input
                        type="text"
                        key={`color-text-${block.id}`}
                        defaultValue={(block.styles.color as string) || "#1e293b"}
                        onBlur={(e) => updateBlockStyle(block.id, "color", e.target.value)}
                        className="input flex-1 text-sm font-mono"
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs text-ide-text-muted mb-1">Align</label>
                <div className="flex gap-1">
                    <AlignButton
                        active={block.styles["text-align"] === "left"}
                        onClick={() => updateBlockStyle(block.id, "text-align", "left")}
                        icon="M4 6h16M4 12h10M4 18h16"
                    />
                    <AlignButton
                        active={block.styles["text-align"] === "center"}
                        onClick={() => updateBlockStyle(block.id, "text-align", "center")}
                        icon="M4 6h16M4 12h16M4 18h16"
                    />
                    <AlignButton
                        active={block.styles["text-align"] === "right"}
                        onClick={() => updateBlockStyle(block.id, "text-align", "right")}
                        icon="M4 6h16M10 12h10M4 18h16"
                    />
                    <AlignButton
                        active={block.styles["text-align"] === "justify"}
                        onClick={() => updateBlockStyle(block.id, "text-align", "justify")}
                        icon="M4 6h12M4 12h16M4 18h14"
                    />
                </div>
            </div>
        </div>
    );
};

// Spacing Editor
const SpacingEditor: React.FC<EditorProps> = ({ block }) => {
    return (
        <div className="space-y-3">
            <div>
                <label className="block text-xs text-ide-text-muted mb-1">Margin</label>
                <div className="grid grid-cols-4 gap-1">
                    <input
                        type="text"
                        placeholder="0"
                        key={`margin-top-${block.id}`}
                        defaultValue={(block.styles["margin-top"] as string) || ""}
                        onBlur={(e) => updateBlockStyle(block.id, "margin-top", e.target.value)}
                        className="input text-sm text-center"
                        title="Top"
                    />
                    <input
                        type="text"
                        placeholder="0"
                        key={`margin-right-${block.id}`}
                        defaultValue={(block.styles["margin-right"] as string) || ""}
                        onBlur={(e) => updateBlockStyle(block.id, "margin-right", e.target.value)}
                        className="input text-sm text-center"
                        title="Right"
                    />
                    <input
                        type="text"
                        placeholder="0"
                        key={`margin-bottom-${block.id}`}
                        defaultValue={(block.styles["margin-bottom"] as string) || ""}
                        onBlur={(e) => updateBlockStyle(block.id, "margin-bottom", e.target.value)}
                        className="input text-sm text-center"
                        title="Bottom"
                    />
                    <input
                        type="text"
                        placeholder="0"
                        key={`margin-left-${block.id}`}
                        defaultValue={(block.styles["margin-left"] as string) || ""}
                        onBlur={(e) => updateBlockStyle(block.id, "margin-left", e.target.value)}
                        className="input text-sm text-center"
                        title="Left"
                    />
                </div>
                <div className="grid grid-cols-4 gap-1 mt-1 text-[10px] text-ide-text-muted text-center">
                    <span>Top</span>
                    <span>Right</span>
                    <span>Bottom</span>
                    <span>Left</span>
                </div>
            </div>

            <div>
                <label className="block text-xs text-ide-text-muted mb-1">Padding</label>
                <div className="grid grid-cols-4 gap-1">
                    <input
                        type="text"
                        placeholder="0"
                        key={`padding-top-${block.id}`}
                        defaultValue={(block.styles["padding-top"] as string) || ""}
                        onBlur={(e) => updateBlockStyle(block.id, "padding-top", e.target.value)}
                        className="input text-sm text-center"
                        title="Top"
                    />
                    <input
                        type="text"
                        placeholder="0"
                        key={`padding-right-${block.id}`}
                        defaultValue={(block.styles["padding-right"] as string) || ""}
                        onBlur={(e) => updateBlockStyle(block.id, "padding-right", e.target.value)}
                        className="input text-sm text-center"
                        title="Right"
                    />
                    <input
                        type="text"
                        placeholder="0"
                        key={`padding-bottom-${block.id}`}
                        defaultValue={(block.styles["padding-bottom"] as string) || ""}
                        onBlur={(e) => updateBlockStyle(block.id, "padding-bottom", e.target.value)}
                        className="input text-sm text-center"
                        title="Bottom"
                    />
                    <input
                        type="text"
                        placeholder="0"
                        key={`padding-left-${block.id}`}
                        defaultValue={(block.styles["padding-left"] as string) || ""}
                        onBlur={(e) => updateBlockStyle(block.id, "padding-left", e.target.value)}
                        className="input text-sm text-center"
                        title="Left"
                    />
                </div>
                <div className="grid grid-cols-4 gap-1 mt-1 text-[10px] text-ide-text-muted text-center">
                    <span>Top</span>
                    <span>Right</span>
                    <span>Bottom</span>
                    <span>Left</span>
                </div>
            </div>
        </div>
    );
};

// Align Button Component
interface AlignButtonProps {
    icon: string;
    active?: boolean;
    onClick?: () => void;
}

const AlignButton: React.FC<AlignButtonProps> = ({ icon, active, onClick }) => {
    return (
        <button
            className={`p-2 rounded transition-colors ${active ? "bg-indigo-500/20 text-indigo-400" : "hover:bg-ide-panel text-ide-text-muted"
                }`}
            onClick={onClick}
        >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={icon} />
            </svg>
        </button>
    );
};

export default Inspector;
