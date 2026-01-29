import React, { useEffect, useState } from 'react';
import { GrapesEditor } from '../../types/grapes';
import { Type, BoxSelect, Palette, Layout, ChevronDown, ChevronRight } from 'lucide-react';

interface StyleInspectorProps {
    editor: GrapesEditor | null;
}

export const StyleInspector: React.FC<StyleInspectorProps> = ({ editor }) => {
    const [selectedComponent, setSelectedComponent] = useState<any>(null);

    useEffect(() => {
        if (!editor) return;

        const updateSelection = () => {
            const selected = editor.getSelected();
            setSelectedComponent(selected);
        };

        editor.on('component:selected', updateSelection);
        editor.on('component:deselected', updateSelection);

        // Initial check
        updateSelection();

        return () => {
            editor.off('component:selected', updateSelection);
            editor.off('component:deselected', updateSelection);
        };
    }, [editor]);

    if (!selectedComponent) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 p-4 text-center">
                <BoxSelect className="w-12 h-12 mb-2 opacity-50" />
                <p className="text-sm">Select an element to style</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#1a1a2e] text-slate-300 overflow-y-auto custom-scrollbar">
            <div className="p-4 border-b border-[#2a2a4a]">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    {selectedComponent.getName() || selectedComponent.getTagName()}
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-mono">
                    {selectedComponent.getId()}
                </p>
            </div>

            <StyleSection title="Typography" icon={<Type size={14} />}>
                <TypographyPanel component={selectedComponent} />
            </StyleSection>

            <StyleSection title="Dimensions" icon={<Layout size={14} />}>
                <DimensionsPanel component={selectedComponent} />
            </StyleSection>

            <StyleSection title="Decorations" icon={<Palette size={14} />}>
                <DecorationsPanel component={selectedComponent} />
            </StyleSection>
        </div>
    );
};

const StyleSection = ({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) => {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <div className="border-b border-[#2a2a4a]">
            <button
                className="w-full flex items-center justify-between p-3 hover:bg-[#2a2a4a]/50 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-400">
                    {icon}
                    {title}
                </div>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {isOpen && (
                <div className="p-3 bg-black/10 animate-in slide-in-from-top-2 fade-in duration-200">
                    {children}
                </div>
            )}
        </div>
    );
};

// Panel Placeholders (will implement one by one)
const TypographyPanel = ({ component }: { component: any }) => {
    const [styles, setStyles] = useState<any>({});

    useEffect(() => {
        if (component) {
            setStyles(component.getStyle());
        }
    }, [component]);

    const updateStyle = (prop: string, value: string) => {
        if (!component) return;
        component.addStyle({ [prop]: value });
        setStyles({ ...styles, [prop]: value });
    };

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-[10px] uppercase text-slate-500 mb-1 block">Font Size</label>
                    <input
                        type="text"
                        value={styles['font-size'] || ''}
                        onChange={(e) => updateStyle('font-size', e.target.value)}
                        placeholder="16px"
                        className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none"
                    />
                </div>
                <div>
                    <label className="text-[10px] uppercase text-slate-500 mb-1 block">Color</label>
                    <div className="flex items-center gap-2 bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1">
                        <div
                            className="w-3 h-3 rounded-full border border-gray-600"
                            style={{ backgroundColor: styles['color'] || 'inherit' }}
                        />
                        <input
                            type="text"
                            value={styles['color'] || ''}
                            onChange={(e) => updateStyle('color', e.target.value)}
                            placeholder="#fff"
                            className="w-full bg-transparent border-none text-xs text-white outline-none"
                        />
                    </div>
                </div>
            </div>
            <div>
                <label className="text-[10px] uppercase text-slate-500 mb-1 block">Text Align</label>
                <div className="flex bg-[#0a0a1a] border border-[#2a2a4a] rounded overflow-hidden">
                    {['left', 'center', 'right', 'justify'].map((align) => (
                        <button
                            key={align}
                            onClick={() => updateStyle('text-align', align)}
                            className={`flex-1 p-1.5 hover:bg-indigo-500/20 ${styles['text-align'] === align ? 'bg-indigo-500 text-white' : 'text-slate-400'}`}
                        >
                            <i className={`fas fa-align-${align} text-xs`}></i>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

const DimensionsPanel = ({ component }: { component: any }) => {
    const [styles, setStyles] = useState<any>({});

    useEffect(() => {
        if (component) {
            setStyles(component.getStyle());
        }
    }, [component]);

    const updateStyle = (prop: string, value: string) => {
        if (!component) return;
        component.addStyle({ [prop]: value });
        setStyles({ ...styles, [prop]: value });
    };

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-[10px] uppercase text-slate-500 mb-1 block">Width</label>
                    <input
                        type="text"
                        value={styles['width'] || ''}
                        onChange={(e) => updateStyle('width', e.target.value)}
                        placeholder="auto"
                        className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none"
                    />
                </div>
                <div>
                    <label className="text-[10px] uppercase text-slate-500 mb-1 block">Height</label>
                    <input
                        type="text"
                        value={styles['height'] || ''}
                        onChange={(e) => updateStyle('height', e.target.value)}
                        placeholder="auto"
                        className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-[10px] uppercase text-slate-500 mb-1 block">Margin</label>
                    <input
                        type="text"
                        value={styles['margin'] || ''}
                        onChange={(e) => updateStyle('margin', e.target.value)}
                        placeholder="0px"
                        className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none"
                    />
                </div>
                <div>
                    <label className="text-[10px] uppercase text-slate-500 mb-1 block">Padding</label>
                    <input
                        type="text"
                        value={styles['padding'] || ''}
                        onChange={(e) => updateStyle('padding', e.target.value)}
                        placeholder="0px"
                        className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none"
                    />
                </div>
            </div>

            <div>
                <label className="text-[10px] uppercase text-slate-500 mb-1 block">Display</label>
                <select
                    value={styles['display'] || 'block'}
                    onChange={(e) => updateStyle('display', e.target.value)}
                    className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none"
                >
                    <option value="block">Block</option>
                    <option value="inline-block">Inline Block</option>
                    <option value="flex">Flex</option>
                    <option value="grid">Grid</option>
                    <option value="none">None</option>
                </select>
            </div>
        </div>
    );
};

const DecorationsPanel = ({ component }: { component: any }) => {
    const [styles, setStyles] = useState<any>({});

    useEffect(() => {
        if (component) {
            setStyles(component.getStyle());
        }
    }, [component]);

    const updateStyle = (prop: string, value: string) => {
        if (!component) return;
        component.addStyle({ [prop]: value });
        setStyles({ ...styles, [prop]: value });
    };

    return (
        <div className="space-y-3">
            <div>
                <label className="text-[10px] uppercase text-slate-500 mb-1 block">Background Color</label>
                <div className="flex items-center gap-2 bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1">
                    <div
                        className="w-3 h-3 rounded-full border border-gray-600"
                        style={{ backgroundColor: styles['background-color'] || 'transparent' }}
                    />
                    <input
                        type="text"
                        value={styles['background-color'] || ''}
                        onChange={(e) => updateStyle('background-color', e.target.value)}
                        placeholder="transparent"
                        className="w-full bg-transparent border-none text-xs text-white outline-none"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-[10px] uppercase text-slate-500 mb-1 block">Border Radius</label>
                    <input
                        type="text"
                        value={styles['border-radius'] || ''}
                        onChange={(e) => updateStyle('border-radius', e.target.value)}
                        placeholder="0px"
                        className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none"
                    />
                </div>
                <div>
                    <label className="text-[10px] uppercase text-slate-500 mb-1 block">Opacity</label>
                    <input
                        type="range"
                        min="0" max="1" step="0.1"
                        value={styles['opacity'] || '1'}
                        onChange={(e) => updateStyle('opacity', e.target.value)}
                        className="w-full h-6 accent-indigo-500"
                    />
                </div>
            </div>

            <div>
                <label className="text-[10px] uppercase text-slate-500 mb-1 block">Border</label>
                <input
                    type="text"
                    value={styles['border'] || ''}
                    onChange={(e) => updateStyle('border', e.target.value)}
                    placeholder="1px solid #000"
                    className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none"
                />
            </div>
        </div>
    );
};
