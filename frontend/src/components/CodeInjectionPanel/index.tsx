import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Code, FileCode, Plus, Save, X, AlertTriangle } from 'lucide-react';
import MonacoEditor from '@monaco-editor/react';
import { useProject } from '../../context/ProjectContext';
import {
    VFSFile,
    createFile,
    getProjectFiles,
    updateFile,
} from '../../services/vfsService';
import { Page, getPages } from '../../services/pageService';

const getErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error) return err.message;
    return fallback;
};

type CodeFileType = 'css' | 'js' | 'inject';

export const CodeInjectionPanel: React.FC = () => {
    const { currentProject } = useProject();
    const projectId = currentProject?._id || '';

    const [files, setFiles] = useState<VFSFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedFileId, setSelectedFileId] = useState<string>('');
    const [content, setContent] = useState('');
    const [scope, setScope] = useState<'global' | 'page'>('global');
    const [pageId, setPageId] = useState<string>('');
    const [pages, setPages] = useState<Page[]>([]);
    const [newFileType, setNewFileType] = useState<CodeFileType>('css');
    const [newFileName, setNewFileName] = useState('');
    const [validationError, setValidationError] = useState<string | null>(null);

    const codeFiles = useMemo(
        () => files.filter((file) => ['css', 'js', 'inject'].includes(file.type)),
        [files]
    );

    const loadFiles = useCallback(async () => {
        if (!projectId) return;
        try {
            setLoading(true);
            const result = await getProjectFiles(projectId, false);
            setFiles(result.files || []);
            setError(null);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load code files'));
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    const loadPages = useCallback(async () => {
        if (!projectId) return;
        try {
            const data = await getPages(projectId);
            setPages(data || []);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load pages'));
        }
    }, [projectId]);

    useEffect(() => {
        loadFiles();
        loadPages();
    }, [loadFiles, loadPages]);

    useEffect(() => {
        const selected = codeFiles.find((file) => file._id === selectedFileId);
        if (selected?.schema && typeof selected.schema === 'object') {
            const schema = selected.schema as { content?: string; scope?: 'global' | 'page'; pageId?: string };
            setContent(schema.content || '');
            setScope(schema.scope || 'global');
            setPageId(schema.pageId || '');
        } else {
            setContent('');
            setScope('global');
            setPageId('');
        }
        setValidationError(null);
    }, [selectedFileId, codeFiles]);

    useEffect(() => {
        if (scope === 'page' && !pageId && pages.length > 0) {
            setPageId(pages[0]._id);
        }
    }, [scope, pageId, pages]);

    const selectedFile = useMemo(() => codeFiles.find((file) => file._id === selectedFileId), [codeFiles, selectedFileId]);
    const editorLanguage = selectedFile?.type === 'css' ? 'css' : selectedFile?.type === 'js' ? 'javascript' : 'html';

    const validateContent = useCallback((nextContent: string, type: CodeFileType | undefined) => {
        if (!type) return;
        if (type === 'js') {
            try {
                // eslint-disable-next-line no-new-func
                new Function(nextContent);
                setValidationError(null);
            } catch (err) {
                setValidationError(getErrorMessage(err, 'Invalid JavaScript'));
            }
        } else if (type === 'css') {
            try {
                if (typeof CSSStyleSheet !== 'undefined') {
                    const sheet = new CSSStyleSheet();
                    sheet.replaceSync(nextContent);
                }
                setValidationError(null);
            } catch (err) {
                setValidationError(getErrorMessage(err, 'Invalid CSS'));
            }
        } else {
            setValidationError(null);
        }
    }, []);

    const handleSave = async () => {
        if (!selectedFileId) return;
        try {
            await updateFile(selectedFileId, { schema: { content, scope, pageId: scope === 'page' ? pageId : undefined } });
            loadFiles();
            window.dispatchEvent(new CustomEvent('vfs-code-updated'));
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to save code'));
        }
    };

    const handleCreate = async () => {
        if (!projectId || !newFileName.trim()) return;
        try {
            const result = await createFile(projectId, newFileName.trim(), newFileType, {
                content: '',
                scope: 'global',
                pageId: undefined,
            });
            setFiles((prev) => [result.file, ...prev]);
            setSelectedFileId(result.file._id);
            setNewFileName('');
            window.dispatchEvent(new CustomEvent('vfs-code-updated'));
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to create file'));
        }
    };

    if (!projectId) {
        return <div className="p-4 text-slate-400 text-sm">Select a project to manage code injection.</div>;
    }

    return (
        <div className="p-4 text-slate-200">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Code size={18} />
                    Code Injection
                </h3>
                <button
                    onClick={handleSave}
                    className="p-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
                    aria-label="Save code"
                >
                    <Save size={16} />
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

            <div className="grid grid-cols-1 gap-3 mb-4">
                <label className="text-xs text-slate-400">Select file</label>
                <select
                    value={selectedFileId}
                    onChange={(e) => setSelectedFileId(e.target.value)}
                    className="bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                >
                    <option value="">Choose file</option>
                    {codeFiles.map((file) => (
                        <option key={file._id} value={file._id}>
                            {file.name} · {file.type}
                        </option>
                    ))}
                </select>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                    <label className="text-xs text-slate-400">Scope</label>
                    <select
                        value={scope}
                        onChange={(e) => setScope(e.target.value as 'global' | 'page')}
                        className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                    >
                        <option value="global">Global</option>
                        <option value="page">Per-page</option>
                    </select>
                </div>
                {scope === 'page' ? (
                    <div>
                        <label className="text-xs text-slate-400">Page</label>
                        <select
                            value={pageId}
                            onChange={(e) => setPageId(e.target.value)}
                            className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                        >
                            {pages.map((page) => (
                                <option key={page._id} value={page._id}>
                                    {page.name}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : (
                    <div>
                        <label className="text-xs text-slate-400">Content</label>
                        <div className="text-[11px] text-slate-500">Stored in VFS schema</div>
                    </div>
                )}
            </div>

            <div className="border border-[#2a2a4a] rounded overflow-hidden">
                <MonacoEditor
                    height="240px"
                    language={editorLanguage}
                    theme="vs-dark"
                    value={content}
                    onChange={(value) => {
                        const nextValue = value || '';
                        setContent(nextValue);
                        validateContent(nextValue, selectedFile?.type as CodeFileType | undefined);
                    }}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 12,
                        wordWrap: 'on',
                        scrollBeyondLastLine: false,
                    }}
                />
            </div>

            {validationError && (
                <div className="mt-2 p-2 rounded border border-amber-500/40 bg-amber-500/10 text-amber-200 text-xs flex items-center gap-2">
                    <AlertTriangle size={12} />
                    {validationError}
                </div>
            )}

            <div className="border-t border-[#2a2a4a] mt-4 pt-3">
                <div className="text-xs text-slate-400 mb-2">Create new file</div>
                <div className="grid grid-cols-3 gap-2">
                    <input
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        className="col-span-2 bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                        placeholder="File name"
                    />
                    <select
                        value={newFileType}
                        onChange={(e) => setNewFileType(e.target.value as CodeFileType)}
                        className="bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                    >
                        <option value="css">CSS</option>
                        <option value="js">JS</option>
                        <option value="inject">Head</option>
                    </select>
                </div>
                <div className="flex justify-end mt-2">
                    <button
                        onClick={handleCreate}
                        className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600"
                    >
                        <Plus size={14} />
                        <span className="ml-1">Create</span>
                    </button>
                </div>
            </div>

            {loading && (
                <div className="text-xs text-slate-400 mt-2">Loading files...</div>
            )}
        </div>
    );
};
