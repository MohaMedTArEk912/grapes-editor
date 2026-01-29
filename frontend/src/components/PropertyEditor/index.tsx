import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GrapesEditor } from '../../types/grapes';
import { Settings, Link, Type, Hash, ChevronDown, ChevronRight, Plus, Trash2, Copy } from 'lucide-react';

interface PropertyEditorProps {
    editor: GrapesEditor | null;
}

interface TraitDefinition {
    name: string;
    label: string;
    type: 'text' | 'number' | 'checkbox' | 'select' | 'color' | 'button';
    value?: string | number | boolean;
    options?: { id: string; name: string }[];
    placeholder?: string;
}

export const PropertyEditor: React.FC<PropertyEditorProps> = ({ editor }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [selectedComponent, setSelectedComponent] = useState<any>(null);
    const [traits, setTraits] = useState<TraitDefinition[]>([]);
    const [attributes, setAttributes] = useState<Record<string, string>>({});
    const [isAddingAttribute, setIsAddingAttribute] = useState(false);
    const [newAttrKey, setNewAttrKey] = useState('');
    const [newAttrValue, setNewAttrValue] = useState('');
    const [expandedSections, setExpandedSections] = useState({ common: true, link: true, custom: true });

    useEffect(() => {
        if (!editor) return;
        const updateSelection = () => {
            const selected = editor.getSelected();
            setSelectedComponent(selected);
            if (selected) {
                const componentTraits = selected.getTraits();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const mappedTraits: TraitDefinition[] = componentTraits.map((trait: any) => ({
                    name: trait.get('name'),
                    label: trait.get('label') || trait.get('name'),
                    type: trait.get('type') || 'text',
                    value: trait.get('value'),
                    options: trait.get('options'),
                    placeholder: trait.get('placeholder'),
                }));
                setTraits(mappedTraits);
                setAttributes(selected.getAttributes());
            } else {
                setTraits([]);
                setAttributes({});
            }
        };
        editor.on('component:selected', updateSelection);
        editor.on('component:deselected', updateSelection);
        editor.on('trait:change', updateSelection);
        updateSelection();
        return () => {
            editor.off('component:selected', updateSelection);
            editor.off('component:deselected', updateSelection);
            editor.off('trait:change', updateSelection);
        };
    }, [editor]);

    const updateTrait = useCallback((name: string, value: string | number | boolean) => {
        if (!selectedComponent) return;
        const trait = selectedComponent.getTrait(name);
        if (trait) {
            trait.set('value', value);
            selectedComponent.set(`attributes.${name}`, value);
        }
    }, [selectedComponent]);

    const updateAttribute = useCallback((key: string, value: string) => {
        if (!selectedComponent) return;
        selectedComponent.addAttributes({ [key]: value });
        setAttributes(prev => ({ ...prev, [key]: value }));
    }, [selectedComponent]);

    const removeAttribute = useCallback((key: string) => {
        if (!selectedComponent) return;
        selectedComponent.removeAttributes(key);
        setAttributes(prev => { const n = { ...prev }; delete n[key]; return n; });
    }, [selectedComponent]);

    const handleAddAttribute = () => {
        if (!newAttrKey.trim()) return;
        updateAttribute(newAttrKey.trim(), newAttrValue);
        setNewAttrKey(''); setNewAttrValue(''); setIsAddingAttribute(false);
    };

    const categorizedTraits = useMemo(() => {
        const common: TraitDefinition[] = [], link: TraitDefinition[] = [];
        traits.forEach(trait => {
            if (['href', 'target', 'rel', 'download'].includes(trait.name)) link.push(trait);
            else common.push(trait);
        });
        return { common, link };
    }, [traits]);

    const customAttributes = useMemo(() => {
        const traitNames = traits.map(t => t.name);
        const reserved = ['id', 'class', 'style', ...traitNames];
        return Object.entries(attributes).filter(([key]) => !reserved.includes(key) && !key.startsWith('data-gjs'));
    }, [attributes, traits]);

    const renderTraitInput = (trait: TraitDefinition) => {
        const cls = "w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1.5 text-xs text-white focus:border-indigo-500 outline-none";
        switch (trait.type) {
            case 'checkbox':
                return (<label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!trait.value} onChange={(e) => updateTrait(trait.name, e.target.checked)} className="w-4 h-4 rounded" /><span className="text-xs text-slate-300">{trait.label}</span></label>);
            case 'select':
                return (<select value={trait.value as string || ''} onChange={(e) => updateTrait(trait.name, e.target.value)} className={cls}><option value="">Select...</option>{trait.options?.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>);
            case 'number':
                return <input type="number" value={trait.value as number || ''} onChange={(e) => updateTrait(trait.name, parseFloat(e.target.value))} className={cls} />;
            case 'color':
                return (<div className="flex gap-2"><input type="color" value={trait.value as string || '#000'} onChange={(e) => updateTrait(trait.name, e.target.value)} className="w-8 h-8 rounded" /><input type="text" value={trait.value as string || ''} onChange={(e) => updateTrait(trait.name, e.target.value)} className={`flex-1 ${cls}`} /></div>);
            default:
                return <input type="text" value={trait.value as string || ''} onChange={(e) => updateTrait(trait.name, e.target.value)} placeholder={trait.placeholder} className={cls} />;
        }
    };

    if (!selectedComponent) {
        return (<div className="flex flex-col items-center justify-center h-full text-slate-500 p-4 text-center"><Settings className="w-12 h-12 mb-2 opacity-50" /><p className="text-sm">Select an element to edit properties</p></div>);
    }

    return (
        <div className="flex flex-col h-full bg-[#1a1a2e] text-slate-300 overflow-y-auto custom-scrollbar">
            <div className="p-4 border-b border-[#2a2a4a]">
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500"></span><h3 className="text-sm font-semibold text-white">{selectedComponent.getName() || selectedComponent.getTagName()}</h3></div>
                <div className="flex items-center gap-2 mt-2"><span className="text-xs text-slate-500 font-mono">ID:</span><code className="text-xs text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">{selectedComponent.getId()}</code><button onClick={() => navigator.clipboard.writeText(selectedComponent.getId())} className="p-1 text-slate-500 hover:text-white"><Copy size={12} /></button></div>
            </div>
            {categorizedTraits.common.length > 0 && (
                <Section title="Common Properties" icon={<Settings size={14} />} isOpen={expandedSections.common} onToggle={() => setExpandedSections(p => ({ ...p, common: !p.common }))}>
                    <div className="space-y-3">{categorizedTraits.common.map(t => <div key={t.name}>{t.type !== 'checkbox' && <label className="flex items-center gap-1.5 text-[10px] uppercase text-slate-500 mb-1"><Type size={12} />{t.label}</label>}{renderTraitInput(t)}</div>)}</div>
                </Section>
            )}
            {categorizedTraits.link.length > 0 && (
                <Section title="Link Settings" icon={<Link size={14} />} isOpen={expandedSections.link} onToggle={() => setExpandedSections(p => ({ ...p, link: !p.link }))}>
                    <div className="space-y-3">{categorizedTraits.link.map(t => <div key={t.name}><label className="flex items-center gap-1.5 text-[10px] uppercase text-slate-500 mb-1"><Link size={12} />{t.label}</label>{renderTraitInput(t)}</div>)}</div>
                </Section>
            )}
            <Section title="Custom Attributes" icon={<Hash size={14} />} isOpen={expandedSections.custom} onToggle={() => setExpandedSections(p => ({ ...p, custom: !p.custom }))} action={<button onClick={() => setIsAddingAttribute(true)} className="p-1 text-slate-400 hover:text-indigo-400"><Plus size={14} /></button>}>
                <div className="space-y-2">
                    {isAddingAttribute && (<div className="p-2 bg-[#0a0a1a] rounded border border-[#2a2a4a] space-y-2"><input type="text" placeholder="Attribute name" value={newAttrKey} onChange={(e) => setNewAttrKey(e.target.value)} className="w-full bg-[#1a1a2e] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white" /><input type="text" placeholder="Value" value={newAttrValue} onChange={(e) => setNewAttrValue(e.target.value)} className="w-full bg-[#1a1a2e] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white" /><div className="flex justify-end gap-2"><button onClick={() => setIsAddingAttribute(false)} className="px-2 py-1 text-xs text-slate-400">Cancel</button><button onClick={handleAddAttribute} className="px-3 py-1 text-xs bg-indigo-500 text-white rounded">Add</button></div></div>)}
                    {customAttributes.length === 0 && !isAddingAttribute && <p className="text-xs text-slate-500 italic text-center py-2">No custom attributes</p>}
                    {customAttributes.map(([key, value]) => (<div key={key} className="flex items-center gap-2 p-2 bg-[#0a0a1a] rounded border border-[#2a2a4a] group"><code className="text-xs text-indigo-400 truncate">{key}</code><span className="text-slate-600">=</span><input type="text" value={value} onChange={(e) => updateAttribute(key, e.target.value)} className="flex-1 bg-transparent border-none text-xs text-white outline-none" /><button onClick={() => removeAttribute(key)} className="p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button></div>))}
                </div>
            </Section>
        </div>
    );
};

const Section: React.FC<{ title: string; icon: React.ReactNode; isOpen: boolean; onToggle: () => void; action?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, isOpen, onToggle, action, children }) => (
    <div className="border-b border-[#2a2a4a]">
        <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-[#2a2a4a]/30" onClick={onToggle}>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-400">{icon}{title}</div>
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>{action}{isOpen ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}</div>
        </div>
        {isOpen && <div className="p-3 pt-0 bg-black/10">{children}</div>}
    </div>
);

export default PropertyEditor;
