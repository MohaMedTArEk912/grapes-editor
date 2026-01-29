import React, { useState, useEffect, useCallback } from 'react';
import { GrapesEditor } from '../../types/grapes';
import { LayoutGrid, ArrowRight, ArrowDown, AlignHorizontalJustifyStart, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignHorizontalSpaceBetween, AlignHorizontalSpaceAround, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, Rows, Columns, ChevronDown, ChevronRight } from 'lucide-react';

interface AutoLayoutPanelProps {
    editor: GrapesEditor | null;
}

interface FlexStyles {
    display: string;
    'flex-direction': string;
    'flex-wrap': string;
    'justify-content': string;
    'align-items': string;
    gap: string;
}

export const AutoLayoutPanel: React.FC<AutoLayoutPanelProps> = ({ editor }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [selectedComponent, setSelectedComponent] = useState<any>(null);
    const [styles, setStyles] = useState<FlexStyles>({ display: 'block', 'flex-direction': 'row', 'flex-wrap': 'nowrap', 'justify-content': 'flex-start', 'align-items': 'stretch', gap: '0px' });
    const [isOpen, setIsOpen] = useState(true);

    useEffect(() => {
        if (!editor) return;
        const updateSelection = () => {
            const selected = editor.getSelected();
            setSelectedComponent(selected);
            if (selected) {
                const s = selected.getStyle() as Record<string, string>;
                setStyles({
                    display: String(s['display'] || 'block'),
                    'flex-direction': String(s['flex-direction'] || 'row'),
                    'flex-wrap': String(s['flex-wrap'] || 'nowrap'),
                    'justify-content': String(s['justify-content'] || 'flex-start'),
                    'align-items': String(s['align-items'] || 'stretch'),
                    gap: String(s['gap'] || '0px'),
                });
            }
        };
        editor.on('component:selected', updateSelection);
        editor.on('component:deselected', updateSelection);
        editor.on('component:styleUpdate', updateSelection);
        updateSelection();
        return () => {
            editor.off('component:selected', updateSelection);
            editor.off('component:deselected', updateSelection);
            editor.off('component:styleUpdate', updateSelection);
        };
    }, [editor]);

    const updateStyle = useCallback((prop: string, value: string) => {
        if (!selectedComponent) return;
        selectedComponent.addStyle({ [prop]: value });
        setStyles(prev => ({ ...prev, [prop]: value }));
    }, [selectedComponent]);

    const toggleFlex = useCallback(() => {
        if (!selectedComponent) return;
        const newDisplay = styles.display === 'flex' ? 'block' : 'flex';
        updateStyle('display', newDisplay);
    }, [selectedComponent, styles.display, updateStyle]);

    if (!selectedComponent) return null;

    const isFlex = styles.display === 'flex';
    const isRow = styles['flex-direction'] === 'row' || styles['flex-direction'] === 'row-reverse';

    return (
        <div className="border-b border-[#2a2a4a]">
            <button className="w-full flex items-center justify-between p-3 hover:bg-[#2a2a4a]/50" onClick={() => setIsOpen(!isOpen)}>
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-400"><LayoutGrid size={14} />Auto Layout</div>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {isOpen && (
                <div className="p-3 bg-black/10 space-y-4">
                    {/* Enable Flex Toggle */}
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Enable Flexbox</span>
                        <button onClick={toggleFlex} className={`w-12 h-6 rounded-full transition-colors relative ${isFlex ? 'bg-indigo-500' : 'bg-[#2a2a4a]'}`}>
                            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isFlex ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>
                    {isFlex && (
                        <>
                            {/* Direction */}
                            <div>
                                <label className="text-[10px] uppercase text-slate-500 mb-2 block">Direction</label>
                                <div className="grid grid-cols-4 gap-1 bg-[#0a0a1a] p-1 rounded">
                                    {[{ v: 'row', i: <ArrowRight size={14} />, l: 'Row' }, { v: 'column', i: <ArrowDown size={14} />, l: 'Column' }, { v: 'row-reverse', i: <ArrowRight size={14} className="rotate-180" />, l: 'Row Rev' }, { v: 'column-reverse', i: <ArrowDown size={14} className="rotate-180" />, l: 'Col Rev' }].map(d => (
                                        <button key={d.v} onClick={() => updateStyle('flex-direction', d.v)} title={d.l} className={`p-2 rounded flex items-center justify-center ${styles['flex-direction'] === d.v ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>{d.i}</button>
                                    ))}
                                </div>
                            </div>
                            {/* Justify Content */}
                            <div>
                                <label className="text-[10px] uppercase text-slate-500 mb-2 block">{isRow ? 'Horizontal' : 'Vertical'} Align</label>
                                <div className="grid grid-cols-5 gap-1 bg-[#0a0a1a] p-1 rounded">
                                    {[{ v: 'flex-start', i: <AlignHorizontalJustifyStart size={14} /> }, { v: 'center', i: <AlignHorizontalJustifyCenter size={14} /> }, { v: 'flex-end', i: <AlignHorizontalJustifyEnd size={14} /> }, { v: 'space-between', i: <AlignHorizontalSpaceBetween size={14} /> }, { v: 'space-around', i: <AlignHorizontalSpaceAround size={14} /> }].map(j => (
                                        <button key={j.v} onClick={() => updateStyle('justify-content', j.v)} className={`p-2 rounded flex items-center justify-center ${styles['justify-content'] === j.v ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>{j.i}</button>
                                    ))}
                                </div>
                            </div>
                            {/* Align Items */}
                            <div>
                                <label className="text-[10px] uppercase text-slate-500 mb-2 block">{isRow ? 'Vertical' : 'Horizontal'} Align</label>
                                <div className="grid grid-cols-5 gap-1 bg-[#0a0a1a] p-1 rounded">
                                    {[{ v: 'flex-start', i: <AlignVerticalJustifyStart size={14} /> }, { v: 'center', i: <AlignVerticalJustifyCenter size={14} /> }, { v: 'flex-end', i: <AlignVerticalJustifyEnd size={14} /> }, { v: 'stretch', i: <Rows size={14} /> }, { v: 'baseline', i: <Columns size={14} /> }].map(a => (
                                        <button key={a.v} onClick={() => updateStyle('align-items', a.v)} className={`p-2 rounded flex items-center justify-center ${styles['align-items'] === a.v ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>{a.i}</button>
                                    ))}
                                </div>
                            </div>
                            {/* Wrap */}
                            <div>
                                <label className="text-[10px] uppercase text-slate-500 mb-2 block">Wrap</label>
                                <div className="grid grid-cols-3 gap-1 bg-[#0a0a1a] p-1 rounded">
                                    {[{ v: 'nowrap', l: 'No Wrap' }, { v: 'wrap', l: 'Wrap' }, { v: 'wrap-reverse', l: 'Reverse' }].map(w => (
                                        <button key={w.v} onClick={() => updateStyle('flex-wrap', w.v)} className={`p-2 rounded text-xs ${styles['flex-wrap'] === w.v ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>{w.l}</button>
                                    ))}
                                </div>
                            </div>
                            {/* Gap */}
                            <div>
                                <label className="text-[10px] uppercase text-slate-500 mb-2 block">Gap</label>
                                <input type="text" value={styles.gap} onChange={(e) => updateStyle('gap', e.target.value)} placeholder="10px" className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1.5 text-xs text-white focus:border-indigo-500 outline-none" />
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default AutoLayoutPanel;
