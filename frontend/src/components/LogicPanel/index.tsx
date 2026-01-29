import { useEffect, useState } from 'react';
import { useLogic } from '../../context/LogicContext';
import { GrapesEditor } from '../../types/grapes';
import { Plus, Trash2, Database, ChevronRight, ChevronDown, Zap, Play, Settings } from 'lucide-react';

interface LogicPanelProps {
    editor: GrapesEditor | null;
}

export const LogicPanel: React.FC<LogicPanelProps> = ({ editor }) => {
    const { variables, addVariable, removeVariable, flows, addFlow, removeFlow, updateFlow } = useLogic();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [selectedComponent, setSelectedComponent] = useState<any>(null);
    const [isAddingVar, setIsAddingVar] = useState(false);
    const [isAddingFlow, setIsAddingFlow] = useState(false);

    // Action Builder State
    const [addingActionToFlow, setAddingActionToFlow] = useState<string | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [newAction, setNewAction] = useState({ type: 'alert', params: {} as any });

    // Selection Logic
    useEffect(() => {
        if (!editor) return;
        const updateSelection = () => {
            const selected = editor.getSelected();
            setSelectedComponent(selected);
        };
        editor.on('component:selected', updateSelection);
        editor.on('component:deselected', updateSelection);
        updateSelection();
        return () => {
            editor.off('component:selected', updateSelection);
            editor.off('component:deselected', updateSelection);
        };
    }, [editor]);

    // Component-specific flows
    const componentFlows = flows.filter(f => f.componentId === selectedComponent?.getId());

    const [newVar, setNewVar] = useState({ name: '', type: 'string', defaultValue: '' });
    const [newFlow, setNewFlow] = useState({ event: 'click' });

    const handleAddVar = () => {
        if (!newVar.name) return;
        addVariable({
            name: newVar.name,
            type: newVar.type as 'string' | 'number' | 'boolean',
            defaultValue: newVar.defaultValue
        });
        setIsAddingVar(false);
        setNewVar({ name: '', type: 'string', defaultValue: '' });
    };

    const handleAddFlow = () => {
        if (!selectedComponent) return;
        addFlow({
            name: `On ${newFlow.event}`,
            componentId: selectedComponent.getId(),
            event: newFlow.event as 'click' | 'change' | 'load',
            actions: []
        });
        setIsAddingFlow(false);
    };

    const handleAddAction = (flowId: string) => {
        const flow = flows.find(f => f.id === flowId);
        if (!flow) return;

        const actionToAdd = {
            id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            type: newAction.type as any,
            params: newAction.params
        };

        updateFlow(flowId, {
            actions: [...flow.actions, actionToAdd]
        });

        setAddingActionToFlow(null);
        setNewAction({ type: 'alert', params: {} });
    };

    return (
        <div className="flex flex-col h-full bg-[#1a1a2e] text-slate-300 overflow-y-auto custom-scrollbar">
            <VariableSection
                title="Global Variables"
                count={variables.length}
                onAdd={() => setIsAddingVar(true)}
            >
                {isAddingVar && (
                    <div className="p-3 bg-[#0a0a1a] border-b border-[#2a2a4a] space-y-2">
                        <input
                            type="text"
                            placeholder="Variable Name"
                            value={newVar.name}
                            onChange={(e) => setNewVar({ ...newVar, name: e.target.value })}
                            className="w-full bg-[#1a1a2e] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none"
                        />
                        <div className="flex gap-2">
                            <select
                                value={newVar.type}
                                onChange={(e) => setNewVar({ ...newVar, type: e.target.value })}
                                className="flex-1 bg-[#1a1a2e] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none"
                            >
                                <option value="string">String</option>
                                <option value="number">Number</option>
                                <option value="boolean">Boolean</option>
                            </select>
                            <input
                                type="text"
                                placeholder="Default Value"
                                value={newVar.defaultValue}
                                onChange={(e) => setNewVar({ ...newVar, defaultValue: e.target.value })}
                                className="flex-1 bg-[#1a1a2e] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none"
                            />
                        </div>
                        <div className="flex justify-end gap-2 mt-2">
                            <button
                                onClick={() => setIsAddingVar(false)}
                                className="px-2 py-1 text-xs text-slate-400 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddVar}
                                className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600"
                            >
                                Create
                            </button>
                        </div>
                    </div>
                )}

                {variables.length === 0 && !isAddingVar && (
                    <div className="p-4 text-center text-xs text-slate-500">
                        No variables defined yet.
                    </div>
                )}

                {variables.map((variable) => (
                    <div key={variable.id} className="flex items-center justify-between p-3 border-b border-[#2a2a4a] hover:bg-[#2a2a4a]/30 group">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-white">{variable.name}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${getTypeColor(variable.type)}`}>
                                    {variable.type}
                                </span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1">
                                Default: <span className="font-mono text-slate-400">{String(variable.defaultValue)}</span>
                            </div>
                        </div>
                        <button
                            onClick={() => removeVariable(variable.id)}
                            className="p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                ))}
            </VariableSection>

            {/* Component Events Section */}
            <div className="border-b border-[#2a2a4a]">
                <div className="p-3 bg-[#1a1a2e] border-b border-[#2a2a4a]">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2 mb-2">
                        <Zap size={14} />
                        Component Events
                    </h3>

                    {!selectedComponent ? (
                        <div className="text-xs text-slate-500 italic p-2 border border-dashed border-[#2a2a4a] rounded text-center">
                            Select a component to add events
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-white p-2 bg-[#2a2a4a]/30 rounded">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                {selectedComponent.getName() || selectedComponent.getTagName()}
                                <span className="text-xs text-slate-500 font-mono ml-auto">{selectedComponent.getId()}</span>
                            </div>

                            <button
                                onClick={() => setIsAddingFlow(true)}
                                className="w-full py-1.5 flex items-center justify-center gap-2 text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded hover:bg-indigo-500/20 transition-all"
                            >
                                <Plus size={12} /> Add Event Listener
                            </button>

                            {isAddingFlow && (
                                <div className="p-2 bg-[#0a0a1a] rounded border border-[#2a2a4a] animate-in fade-in zoom-in-95 duration-200">
                                    <label className="text-[10px] uppercase text-slate-500 mb-1 block">Trigger Event</label>
                                    <select
                                        value={newFlow.event}
                                        onChange={(e) => setNewFlow({ ...newFlow, event: e.target.value })}
                                        className="w-full bg-[#1a1a2e] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none mb-2"
                                    >
                                        <option value="click">On Click</option>
                                        <option value="change">On Change / Input</option>
                                        <option value="load">On Load / Mount</option>
                                    </select>
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => setIsAddingFlow(false)}
                                            className="px-2 py-1 text-xs text-slate-400 hover:text-white"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleAddFlow}
                                            className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600"
                                        >
                                            Add Helper
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* List Component Flows */}
                            <div className="space-y-2">
                                {componentFlows.map(flow => (
                                    <div key={flow.id} className="bg-[#0a0a1a] border border-[#2a2a4a] rounded">
                                        <div className="flex items-center justify-between p-2 border-b border-[#2a2a4a]/50">
                                            <div className="flex items-center gap-2">
                                                <Play size={12} className="text-yellow-500" />
                                                <span className="text-xs font-medium text-slate-200">On {flow.event}</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <button className="p-1 text-slate-500 hover:text-white" title="Configure"><Settings size={12} /></button>
                                                <button
                                                    onClick={() => removeFlow(flow.id)}
                                                    className="p-1 text-slate-500 hover:text-red-400"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="p-2">
                                            {flow.actions.length === 0 ? (
                                                <div className="text-[10px] text-slate-600 italic text-center py-2">
                                                    No actions defined
                                                </div>
                                            ) : (
                                                <div className="text-[10px] text-white">
                                                    {flow.actions.length} actions configured
                                                </div>
                                            )}

                                            {/* Action List */}
                                            <div className="space-y-1 mt-2">
                                                {flow.actions.map((action, idx) => (
                                                    <div key={action.id} className="flex items-center gap-2 text-xs bg-[#2a2a4a] p-1.5 rounded border-l-2 border-indigo-500">
                                                        <span className="font-mono text-[10px] text-indigo-300">{idx + 1}. {action.type}</span>
                                                        <span className="text-slate-400 truncate flex-1">{JSON.stringify(action.params)}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            {addingActionToFlow === flow.id ? (
                                                <div className="mt-2 p-2 bg-[#2a2a4a]/50 rounded border border-[#2a2a4a]">
                                                    <label className="text-[10px] uppercase text-slate-500 mb-1 block">Action Type</label>
                                                    <select
                                                        value={newAction.type}
                                                        onChange={(e) => setNewAction({ type: e.target.value, params: {} })}
                                                        className="w-full bg-[#1a1a2e] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none mb-2"
                                                    >
                                                        <option value="alert">Show Alert</option>
                                                        <option value="set-variable">Set Variable</option>
                                                        <option value="navigate">Navigate to URL</option>
                                                    </select>

                                                    {newAction.type === 'alert' && (
                                                        <input
                                                            type="text"
                                                            placeholder="Alert Message"
                                                            onChange={(e) => setNewAction({ ...newAction, params: { message: e.target.value } })}
                                                            className="w-full bg-[#1a1a2e] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white mb-2"
                                                        />
                                                    )}

                                                    {newAction.type === 'navigate' && (
                                                        <input
                                                            type="text"
                                                            placeholder="https://example.com"
                                                            onChange={(e) => setNewAction({ ...newAction, params: { url: e.target.value } })}
                                                            className="w-full bg-[#1a1a2e] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white mb-2"
                                                        />
                                                    )}

                                                    {newAction.type === 'set-variable' && (
                                                        <div className="space-y-2 mb-2">
                                                            <select
                                                                onChange={(e) => setNewAction({ ...newAction, params: { ...newAction.params, variableId: e.target.value } })}
                                                                className="w-full bg-[#1a1a2e] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white"
                                                            >
                                                                <option value="">Select Variable...</option>
                                                                {variables.map(v => (
                                                                    <option key={v.id} value={v.id}>{v.name}</option>
                                                                ))}
                                                            </select>
                                                            <input
                                                                type="text"
                                                                placeholder="New Value"
                                                                onChange={(e) => setNewAction({ ...newAction, params: { ...newAction.params, value: e.target.value } })}
                                                                className="w-full bg-[#1a1a2e] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white"
                                                            />
                                                        </div>
                                                    )}

                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => setAddingActionToFlow(null)}
                                                            className="px-2 py-1 text-xs text-slate-400 hover:text-white"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            onClick={() => handleAddAction(flow.id)}
                                                            className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600"
                                                        >
                                                            Save Action
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setAddingActionToFlow(flow.id)}
                                                    className="w-full mt-2 py-1 text-[10px] text-slate-400 bg-[#2a2a4a]/30 hover:bg-[#2a2a4a] rounded transition-colors dashed-border border-slate-700"
                                                >
                                                    + Add Action
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const VariableSection = ({ title, count, onAdd, children }: any) => {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <div className="border-b border-[#2a2a4a]">
            <div className="flex items-center justify-between p-3 bg-[#1a1a2e]">
                <button
                    className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-400 hover:text-white"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <Database size={14} />
                    {title}
                    <span className="bg-[#2a2a4a] text-slate-300 px-1.5 rounded-full text-[10px]">{count}</span>
                </button>
                <div className="flex items-center gap-1">
                    <button
                        onClick={onAdd}
                        className="p-1 text-slate-400 hover:text-indigo-400 transition-colors"
                        title="Add Variable"
                    >
                        <Plus size={14} />
                    </button>
                    {isOpen ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
                </div>
            </div>

            {isOpen && (
                <div className="bg-black/10 animate-in slide-in-from-top-2 fade-in duration-200">
                    {children}
                </div>
            )}
        </div>
    );
};

// Helper for type badges
const getTypeColor = (type: string) => {
    switch (type) {
        case 'string': return 'bg-green-500/10 text-green-400';
        case 'number': return 'bg-blue-500/10 text-blue-400';
        case 'boolean': return 'bg-purple-500/10 text-purple-400';
        default: return 'bg-slate-500/10 text-slate-400';
    }
}
