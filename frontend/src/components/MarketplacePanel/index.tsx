import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Store, Plus, UploadCloud, Download, X, Globe, Lock } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { createPage } from '../../services/pageService';
import {
    Template,
    createTemplate,
    deleteTemplate,
    getTemplates,
    publishTemplate,
} from '../../services/templateService';
import { GrapesEditor } from '../../types/grapes';

interface MarketplacePanelProps {
    editor: GrapesEditor | null;
    currentPageId?: string;
}

const getErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error) return err.message;
    return fallback;
};

export const MarketplacePanel: React.FC<MarketplacePanelProps> = ({ editor }) => {
    const { currentProject } = useProject();
    const projectId = currentProject?._id || '';
    const [activeTab, setActiveTab] = useState<'market' | 'my'>('market');
    const [templates, setTemplates] = useState<Template[]>([]);
    const [myTemplates, setMyTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState('');
    const [type, setType] = useState<'page' | 'block'>('page');

    const loadTemplates = useCallback(async () => {
        try {
            setLoading(true);
            const market = await getTemplates('public');
            setTemplates(market || []);
            if (projectId) {
                const mine = await getTemplates('project', projectId);
                setMyTemplates(mine || []);
            }
            setError(null);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load templates'));
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        loadTemplates();
    }, [loadTemplates]);

    const templatePreview = useMemo(() => {
        return (template: Template) => ({
            __html: `<style>${template.content?.css || ''}</style>${template.content?.html || ''}`,
        });
    }, []);

    const handleCreateTemplate = async () => {
        if (!projectId || !name.trim()) return;
        try {
            let html = '';
            let css = '';

            if (editor) {
                if (type === 'page') {
                    html = editor.getHtml() || '';
                    css = editor.getCss() || '';
                } else {
                    const selected = editor.getSelected();
                    if (selected) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        html = (selected as any).toHTML ? (selected as any).toHTML() : selected.toString();
                    }
                }
            }

            const created = await createTemplate({
                projectId,
                name: name.trim(),
                description: description.trim() || undefined,
                type,
                tags: tags
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                content: { html, css },
                status: 'private',
            });

            setMyTemplates([created, ...myTemplates]);
            setShowCreate(false);
            setName('');
            setDescription('');
            setTags('');
            setType('page');
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to create template'));
        }
    };

    const handleDeleteTemplate = async (templateId: string) => {
        if (!confirm('Delete this template?')) return;
        try {
            await deleteTemplate(templateId);
            setMyTemplates(myTemplates.filter((template) => template._id !== templateId));
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to delete template'));
        }
    };

    const handlePublish = async (template: Template) => {
        try {
            const nextStatus = template.status === 'public' ? 'private' : 'public';
            const updated = await publishTemplate(template._id, nextStatus);
            setMyTemplates(myTemplates.map((item) => (item._id === updated._id ? updated : item)));
            await loadTemplates();
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to update template status'));
        }
    };

    const handleImport = async (template: Template) => {
        if (!projectId) return;
        try {
            if (template.type === 'page') {
                const page = await createPage(projectId, {
                    name: `${template.name} Copy`,
                    content: { html: template.content?.html || '', css: template.content?.css || '' },
                    styles: template.content?.css || '',
                });
                alert(`Created page ${page.name}`);
            } else if (template.type === 'block' && editor) {
                editor.addComponents(template.content?.html || '');
            }
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to import template'));
        }
    };
    return (
        <div className="p-4 text-slate-200">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Store size={18} />
                    Templates
                </h3>
                <button
                    onClick={() => setShowCreate(true)}
                    className="p-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
                    aria-label="Create template"
                >
                    <Plus size={16} />
                </button>
            </div>

            {error && (
                <div className="mb-3 p-2 bg-red-500/20 text-red-300 rounded text-sm flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="text-red-300">
                        <X size={14} />
                    </button>
                </div>
            )}

            <div className="flex items-center gap-2 mb-4 text-xs">
                {(['market', 'my'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-3 py-1 rounded border transition-colors ${
                            activeTab === tab
                                ? 'bg-indigo-500/20 text-indigo-200 border-indigo-500/40'
                                : 'bg-[#0a0a1a] text-slate-400 border-[#2a2a4a] hover:text-white'
                        }`}
                    >
                        {tab === 'market' ? 'Marketplace' : 'My Templates'}
                    </button>
                ))}
            </div>

            {loading && (
                <div className="text-slate-400 text-sm">Loading templates...</div>
            )}

            {!loading && activeTab === 'market' && templates.length === 0 && (
                <div className="text-slate-400 text-sm">No public templates yet.</div>
            )}

            {!loading && activeTab === 'my' && myTemplates.length === 0 && (
                <div className="text-slate-400 text-sm">No templates created yet.</div>
            )}

            {activeTab === 'market' && (
                <div className="grid grid-cols-1 gap-3">
                    {templates.map((template) => (
                        <div key={template._id} className="border border-[#2a2a4a] rounded-lg overflow-hidden bg-[#141428]">
                            <div className="p-3">
                                <div className="flex items-center justify-between">
                                    <div className="font-medium text-slate-200">{template.name}</div>
                                    <span className="text-xs text-slate-400">{template.type}</span>
                                </div>
                                {template.description && (
                                    <div className="text-xs text-slate-400 mt-1">{template.description}</div>
                                )}
                                <div className="text-[11px] text-slate-500 mt-2">
                                    {template.tags?.join(', ') || 'No tags'}
                                </div>
                            </div>
                            <div className="bg-white text-black p-3 text-xs max-h-40 overflow-hidden" dangerouslySetInnerHTML={templatePreview(template)} />
                            <div className="flex items-center gap-2 p-3 border-t border-[#2a2a4a]">
                                <button
                                    onClick={() => handleImport(template)}
                                    className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600"
                                >
                                    <Download size={12} className="inline mr-1" />
                                    Import
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'my' && (
                <div className="grid grid-cols-1 gap-3">
                    {myTemplates.map((template) => (
                        <div key={template._id} className="border border-[#2a2a4a] rounded-lg overflow-hidden bg-[#141428]">
                            <div className="p-3">
                                <div className="flex items-center justify-between">
                                    <div className="font-medium text-slate-200">{template.name}</div>
                                    <span className="text-xs text-slate-400">{template.type}</span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-2">
                                    {template.status === 'public' ? <Globe size={12} /> : <Lock size={12} />}
                                    {template.status}
                                </div>
                            </div>
                            <div className="bg-white text-black p-3 text-xs max-h-40 overflow-hidden" dangerouslySetInnerHTML={templatePreview(template)} />
                            <div className="flex items-center gap-2 p-3 border-t border-[#2a2a4a]">
                                <button
                                    onClick={() => handlePublish(template)}
                                    className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600"
                                >
                                    {template.status === 'public' ? <Lock size={12} className="inline mr-1" /> : <Globe size={12} className="inline mr-1" />}
                                    {template.status === 'public' ? 'Unpublish' : 'Publish'}
                                </button>
                                <button
                                    onClick={() => handleImport(template)}
                                    className="px-3 py-1 text-xs bg-[#0a0a1a] border border-[#2a2a4a] rounded text-slate-300"
                                >
                                    <Download size={12} className="inline mr-1" />
                                    Use
                                </button>
                                <button
                                    onClick={() => handleDeleteTemplate(template._id)}
                                    className="px-3 py-1 text-xs bg-red-500/20 text-red-300 rounded"
                                >
                                    <UploadCloud size={12} className="inline mr-1" />
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showCreate && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
                    <div className="w-full max-w-md bg-[#101020] border border-[#2a2a4a] rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold">New Template</h4>
                            <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Name</label>
                                <input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                    placeholder="Template name"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Description</label>
                                <input
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Tags</label>
                                <input
                                    value={tags}
                                    onChange={(e) => setTags(e.target.value)}
                                    className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                    placeholder="landing, saas"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Type</label>
                                <select
                                    value={type}
                                    onChange={(e) => setType(e.target.value as 'page' | 'block')}
                                    className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                >
                                    <option value="page">Page template</option>
                                    <option value="block">Block template</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setShowCreate(false)}
                                    className="px-3 py-1 text-xs text-slate-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateTemplate}
                                    className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600"
                                >
                                    <Plus size={12} className="inline mr-1" />
                                    Create
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
