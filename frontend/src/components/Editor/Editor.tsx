import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useGrapes } from '../../hooks/useGrapes';
import { Toolbar } from '../Toolbar';
import { Box, Paintbrush, Cog, Layers, EyeOff, CircuitBoard, Image, Package, FileStack, Files, Database, History, Users, Code, ShoppingBag, Cloud, BarChart3, ShieldCheck, Store, LayoutTemplate } from 'lucide-react';
import { StyleInspector } from '../StyleInspector';
import { LogicPanel } from '../LogicPanel';
import { PropertyEditor } from '../PropertyEditor';
import { AssetManager } from '../AssetManager';
import { AutoLayoutPanel } from '../AutoLayoutPanel';
import { SymbolPanel } from '../SymbolPanel';
import { PageManager } from '../PageManager';
import { DataModelPanel } from '../DataModelPanel';
import { VersionHistoryPanel } from '../VersionHistoryPanel';
import { CollaborationPanel } from '../CollaborationPanel';
import { CodeInjectionPanel } from '../CodeInjectionPanel';
import { EcommercePanel } from '../EcommercePanel';
import { PublishingPanel } from '../PublishingPanel';
import { AnalyticsPanel } from '../AnalyticsPanel';
import { AccessibilityPanel } from '../AccessibilityPanel';
import { MarketplacePanel } from '../MarketplacePanel';
import { LayoutPanel } from '../LayoutPanel';
import { RuntimeEngine } from '../../utils/runtime';
import { useLogic } from '../../context/LogicContext';
import { Page, getPage, updatePage } from '../../services/pageService';
import { useProject } from '../../context/ProjectContext';
import { useCollaboration } from '../../context/useCollaboration';
import { trackEvent as trackAnalyticsEvent } from '../../services/analyticsService';
import FileTree, { FolderNode, VFSFile as TreeFile, FileAction } from '../FileTree';
import {
    getProjectFiles,
    getFile as getVfsFile,
    updateFile as updateVfsFile,
    deleteFile as deleteVfsFile,
    archiveFile as archiveVfsFile,
    restoreFile as restoreVfsFile,
    createFile as createVfsFile,
    moveFile as moveVfsFile,
    getFileBlocks,
    createBlock,
    updateBlock,
    createVersion,
} from '../../services/vfsService';

export const Editor = () => {
    const { editor, editorRef } = useGrapes();
    const { flows, variables, updateVariable } = useLogic();
    const { currentProject } = useProject();
    const runtimeRef = useRef<RuntimeEngine | null>(null);
    const saveTimerRef = useRef<number | null>(null);
    const applyingRemoteRef = useRef(false);

    const [activeTab, setActiveTab] = useState<'styles' | 'traits' | 'layers' | 'logic' | 'symbols' | 'pages' | 'data' | 'history' | 'collab' | 'code' | 'commerce' | 'publish' | 'analytics' | 'a11y' | 'market' | 'layout'>('styles');
    const [leftTab, setLeftTab] = useState<'blocks' | 'files'>('blocks');
    const [previewMode, setPreviewMode] = useState(false);
    const [isAssetManagerOpen, setIsAssetManagerOpen] = useState(false);

    // Page management state
    const projectId = currentProject?._id || '';
    const [currentPageId, setCurrentPageId] = useState<string | undefined>();
    const [vfsTree, setVfsTree] = useState<FolderNode | null>(null);
    const [vfsFiles, setVfsFiles] = useState<TreeFile[]>([]);
    const [vfsLoading, setVfsLoading] = useState(false);
    const [vfsError, setVfsError] = useState<string | null>(null);
    const [vfsSelectedPath, setVfsSelectedPath] = useState<string | undefined>();
    const [currentFileId, setCurrentFileId] = useState<string | undefined>();
    const [trackingEnabled, setTrackingEnabled] = useState<boolean>(() => localStorage.getItem('analytics_tracking') === 'true');
    const {
        setActivePage,
        sendPageUpdate,
        remoteUpdate,
        setSelectedComponentId,
    } = useCollaboration();

    useEffect(() => {
        setCurrentPageId(undefined);
    }, [projectId]);

    useEffect(() => {
        if (currentPageId) {
            setActivePage(currentPageId);
        }
    }, [currentPageId, setActivePage]);

    const refreshVfs = useCallback(async () => {
        if (!projectId) {
            setVfsTree(null);
            return;
        }
        try {
            setVfsLoading(true);
            const result = await getProjectFiles(projectId);
            setVfsTree(result.tree);
            setVfsFiles(result.files as unknown as TreeFile[]);
            setVfsError(null);
        } catch (err: any) {
            setVfsError(err.message || 'Failed to load files');
        } finally {
            setVfsLoading(false);
        }
    }, [projectId]);

    const getCanvasDocument = useCallback(() => {
        if (!editor) return null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const canvas = editor.Canvas as any;
        const iframe = canvas.getFrameEl?.();
        return iframe?.contentDocument || iframe?.contentWindow?.document || null;
    }, [editor]);

    const applyCodeInjection = useCallback(() => {
        const doc = getCanvasDocument();
        if (!doc) return;

        const marker = 'data-vfs-inject';
        doc.querySelectorAll(`[${marker}]`).forEach((node) => node.remove());

        const head = doc.head || doc.getElementsByTagName('head')[0];
        if (!head) return;

        const codeFiles = vfsFiles.filter((file) => ['css', 'js', 'inject'].includes(file.type));
        const eligible = codeFiles.filter((file) => {
            const schema = file.schema as { content?: string; scope?: 'global' | 'page'; pageId?: string };
            if (!schema?.content) return false;
            if (schema.scope === 'page') {
                return Boolean(currentPageId && schema.pageId === currentPageId);
            }
            return true;
        });

        eligible.forEach((file) => {
            const schema = file.schema as { content?: string; scope?: 'global' | 'page'; pageId?: string };
            const content = schema?.content || '';
            if (!content.trim()) return;

            if (file.type === 'css') {
                const style = doc.createElement('style');
                style.setAttribute(marker, file._id);
                style.textContent = content;
                head.appendChild(style);
            }

            if (file.type === 'js') {
                const script = doc.createElement('script');
                script.setAttribute(marker, file._id);
                script.textContent = `(function(){try{${content}\n}catch(e){console.error('Injected JS error', e);}})();`;
                head.appendChild(script);
            }

            if (file.type === 'inject') {
                const template = doc.createElement('template');
                template.innerHTML = content;
                Array.from(template.content.childNodes).forEach((node) => {
                    if (node instanceof HTMLElement) {
                        node.setAttribute(marker, file._id);
                    }
                    head.appendChild(node);
                });
            }
        });
    }, [currentPageId, getCanvasDocument, vfsFiles]);

    const syncVfsBlocks = useCallback(async (pageId: string, html: string, css: string) => {
        if (!projectId) return;
        const file = vfsFiles.find((f) => (f.schema as { pageId?: string })?.pageId === pageId);
        if (!file) return;
        const blocks = await getFileBlocks(file._id);
        const rootBlock = blocks.blocks?.[0];

        if (rootBlock) {
            await updateBlock(rootBlock._id, {
                props: { html, css },
            });
        } else {
            await createBlock(file._id, 'page-root', { html, css });
        }
    }, [projectId, vfsFiles]);

    useEffect(() => {
        refreshVfs();
    }, [refreshVfs]);

    useEffect(() => {
        const handler = () => {
            setTrackingEnabled(localStorage.getItem('analytics_tracking') === 'true');
        };
        window.addEventListener('analytics-tracking-changed', handler);
        return () => window.removeEventListener('analytics-tracking-changed', handler);
    }, []);

    useEffect(() => {
        const handler = () => refreshVfs();
        window.addEventListener('vfs-code-updated', handler);
        return () => window.removeEventListener('vfs-code-updated', handler);
    }, [refreshVfs]);

    useEffect(() => {
        if (!editor) return;
        applyCodeInjection();
    }, [editor, vfsFiles, currentPageId, applyCodeInjection]);

    const saveCurrentPage = useCallback(async () => {
        if (!editor || !projectId || !currentPageId) return;

        const html = editor.getHtml() || '';
        const css = editor.getCss() || '';

        try {
            await updatePage(projectId, currentPageId, {
                content: { html, css },
                styles: css,
            });
            await syncVfsBlocks(currentPageId, html, css);
        } catch (err) {
            console.error('Failed to save page', err);
        }
    }, [editor, projectId, currentPageId, syncVfsBlocks]);

    // Handle page selection
    const handlePageSelect = useCallback(async (page: Page) => {
        if (page._id === currentPageId) return;

        if (currentPageId) {
            await saveCurrentPage();
        }

        setCurrentPageId(page._id);
        // Load page content into editor
        if (editor) {
            const content = page.content as { html?: string; css?: string } | undefined;
            editor.setComponents(content?.html || '');
            editor.setStyle(content?.css || '');
        }
    }, [editor, currentPageId, saveCurrentPage]);

    const handlePageCreate = useCallback((page: Page) => {
        setCurrentPageId(page._id);
        if (editor) {
            editor.DomComponents.clear();
            editor.CssComposer.clear();
        }
    }, [editor]);

    const handleFileSelect = useCallback(async (file: TreeFile) => {
        setVfsSelectedPath(file.path);
        setCurrentFileId(file._id);

        if (file.type === 'page' && file.schema && projectId) {
            const pageId = (file.schema as { pageId?: string })?.pageId;
            if (pageId) {
                const page = await getPage(projectId, pageId);
                await handlePageSelect(page);
                setActiveTab('pages');
            }
        }
    }, [projectId, handlePageSelect]);

    const handleFileAction = useCallback(async (file: TreeFile, action: FileAction) => {
        try {
            switch (action) {
                case 'open':
                    await handleFileSelect(file);
                    break;
                case 'rename': {
                    const nextName = prompt('New file name:', file.name);
                    if (nextName && nextName.trim() && nextName !== file.name) {
                        await updateVfsFile(file._id, { name: nextName.trim() });
                        await refreshVfs();
                    }
                    break;
                }
                case 'duplicate': {
                    const copyName = `${file.name} Copy`;
                    await createVfsFile(projectId, copyName, file.type as any, file.schema || {});
                    await refreshVfs();
                    break;
                }
                case 'delete':
                    if (confirm('Delete this file permanently?')) {
                        await deleteVfsFile(file._id);
                        await refreshVfs();
                    }
                    break;
                case 'archive':
                    await archiveVfsFile(file._id);
                    await refreshVfs();
                    break;
                case 'restore':
                    await restoreVfsFile(file._id);
                    await refreshVfs();
                    break;
                case 'export':
                    {
                        const result = await getVfsFile(file._id);
                        const payload = JSON.stringify(result.file, null, 2);
                        const blob = new Blob([payload], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${file.name}.${file.type}.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }
                    break;
                case 'snapshot':
                    if (projectId) {
                        const label = prompt('Version label (optional):') || undefined;
                        await createVersion(projectId, label || undefined);
                    }
                    break;
            }
        } catch (err: any) {
            console.error(err);
            alert(err.message || 'File action failed');
        }
    }, [projectId, refreshVfs, handleFileSelect]);

    const handleFileMove = useCallback(async (file: TreeFile, newPath: string) => {
        if (!projectId) return;
        await moveVfsFile(file._id, newPath);
        await refreshVfs();
    }, [projectId, refreshVfs]);

    // Auto-save page on editor updates (debounced)
    useEffect(() => {
        if (!editor) return;

        const onUpdate = () => {
            if (!projectId || !currentPageId) return;
            if (applyingRemoteRef.current) return;
            if (saveTimerRef.current) {
                window.clearTimeout(saveTimerRef.current);
            }
            saveTimerRef.current = window.setTimeout(() => {
                saveCurrentPage();
                const html = editor.getHtml() || '';
                const css = editor.getCss() || '';
                sendPageUpdate(html, css);
            }, 800);
        };

        editor.on('update', onUpdate);

        return () => {
            editor.off('update', onUpdate);
            if (saveTimerRef.current) {
                window.clearTimeout(saveTimerRef.current);
            }
        };
    }, [editor, projectId, currentPageId, saveCurrentPage]);

    useEffect(() => {
        if (!editor || !remoteUpdate || remoteUpdate.pageId !== currentPageId) return;
        applyingRemoteRef.current = true;
        editor.setComponents(remoteUpdate.html || '');
        editor.setStyle(remoteUpdate.css || '');
        window.setTimeout(() => {
            applyingRemoteRef.current = false;
        }, 0);
    }, [editor, remoteUpdate, currentPageId]);

    useEffect(() => {
        if (!editor || !projectId || !currentPageId || !trackingEnabled) return;

        const doc = getCanvasDocument();
        if (!doc) return;

        const handleClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (!target) return;
            const rect = doc.documentElement.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            trackAnalyticsEvent({
                projectId,
                pageId: currentPageId,
                type: 'click',
                x,
                y,
                element: target.tagName.toLowerCase(),
                meta: { id: target.id, className: target.className },
            }).catch(() => undefined);
        };

        const handleSubmit = (event: Event) => {
            const target = event.target as HTMLFormElement | null;
            if (!target) return;
            trackAnalyticsEvent({
                projectId,
                pageId: currentPageId,
                type: 'form_submit',
                element: 'form',
                meta: { id: target.id, className: target.className },
            }).catch(() => undefined);
        };

        doc.addEventListener('click', handleClick);
        doc.addEventListener('submit', handleSubmit, true);

        return () => {
            doc.removeEventListener('click', handleClick);
            doc.removeEventListener('submit', handleSubmit, true);
        };
    }, [editor, projectId, currentPageId, trackingEnabled, getCanvasDocument]);

    useEffect(() => {
        if (!projectId || !currentPageId || !trackingEnabled) return;
        trackAnalyticsEvent({
            projectId,
            pageId: currentPageId,
            type: 'page_view',
        }).catch(() => undefined);
    }, [projectId, currentPageId, trackingEnabled]);

    useEffect(() => {
        if (!editor) return;
        const onSelect = (component: any) => {
            try {
                const id = component?.getId?.();
                setSelectedComponentId(id);
            } catch {
                setSelectedComponentId(undefined);
            }
        };
        const onDeselect = () => setSelectedComponentId(undefined);

        editor.on('component:selected', onSelect);
        editor.on('component:deselected', onDeselect);

        return () => {
            editor.off('component:selected', onSelect);
            editor.off('component:deselected', onDeselect);
        };
    }, [editor, setSelectedComponentId]);

    // Handle Tab Switching
    const handleTabClick = (tab: 'styles' | 'traits' | 'layers' | 'logic' | 'symbols' | 'pages' | 'data' | 'history' | 'collab' | 'code' | 'commerce' | 'publish' | 'analytics' | 'a11y' | 'market' | 'layout') => {
        setActiveTab(tab);
    };

    // Hot reload effect - update runtime when flows/variables change
    useEffect(() => {
        if (runtimeRef.current && runtimeRef.current.isActive()) {
            runtimeRef.current.hotReload(flows, variables);
        }
    }, [flows, variables]);

    // Handle Preview Mode Runtime
    useEffect(() => {
        if (!editor) return;

        const startRuntime = () => {
            console.log('Starting Runtime...');
            runtimeRef.current = new RuntimeEngine(editor, flows, variables, updateVariable);
            runtimeRef.current.start();
            setPreviewMode(true);
        };

        const stopRuntime = () => {
            console.log('Stopping Runtime...');
            if (runtimeRef.current) {
                runtimeRef.current.stop();
                runtimeRef.current = null;
            }
            setPreviewMode(false);
        };

        editor.on('run:preview', startRuntime);
        editor.on('stop:preview', stopRuntime);

        return () => {
            editor.off('run:preview', startRuntime);
            editor.off('stop:preview', stopRuntime);
            if (runtimeRef.current) runtimeRef.current.stop();
        };
    }, [editor, flows, variables, updateVariable]);

    // Listen for Preview Mode
    useEffect(() => {
        if (!editor) return;

        const togglePreview = (active: boolean) => {
            setPreviewMode(active);
        };

        const onCommandRun = (id: string) => {
            if (id === 'preview' || id === 'core:preview') togglePreview(true);
        };

        const onCommandStop = (id: string) => {
            if (id === 'preview' || id === 'core:preview') togglePreview(false);
        };

        if (editor.Commands.isActive('preview')) {
            togglePreview(true);
        }

        editor.on('run', onCommandRun);
        editor.on('stop', onCommandStop);
        const onRunPreview = () => togglePreview(true);
        const onStopPreview = () => togglePreview(false);

        editor.on('run:preview', onRunPreview);
        editor.on('stop:preview', onStopPreview);

        return () => {
            editor.off('run', onCommandRun);
            editor.off('stop', onCommandStop);
            editor.off('run:preview', onRunPreview);
            editor.off('stop:preview', onStopPreview);
        };
    }, [editor]);

    // Handle Escape key to exit preview
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (editor?.Commands.isActive('preview')) {
                    editor.stopCommand('core:preview');
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [editor]);

    // Handle asset selection from Asset Manager
    const handleAssetSelect = useCallback((asset: { src: string }) => {
        if (!editor) return;
        const selected = editor.getSelected();
        if (selected && selected.is('image')) {
            selected.set('src', asset.src);
        }
    }, [editor]);

    return (
        <div className="h-screen w-full flex flex-col bg-[#0f0f23] text-slate-200 overflow-hidden relative">
            {/* Loading Overlay */}
            {!editor && (
                <div className="fixed inset-0 bg-[#0f0f23] z-[9999] flex flex-col items-center justify-center">
                    <div className="w-12 h-12 border-4 border-[#2a2a4a] border-t-indigo-500 rounded-full animate-spin"></div>
                    <p className="mt-4 text-slate-400 text-sm">Loading Editor...</p>
                </div>
            )}

            {!previewMode && <Toolbar editor={editor} onOpenAssetManager={() => setIsAssetManagerOpen(true)} />}

            <div className="flex-1 flex overflow-hidden">

                {/* Left Sidebar - Blocks / Files */}
                <aside className={`w-[280px] bg-[#1a1a2e] border-r border-[#2a2a4a] flex flex-col transition-all duration-300 ${previewMode ? 'hidden' : ''}`}>
                    <div className="border-b border-[#2a2a4a] bg-[#0a0a1a]">
                        <div className="flex items-center gap-2 p-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            {leftTab === 'blocks' ? <Box size={14} /> : <Files size={14} />}
                            {leftTab === 'blocks' ? 'Components & Blocks' : 'Project Files'}
                        </div>
                        <div className="grid grid-cols-2">
                            <button
                                onClick={() => setLeftTab('blocks')}
                                className={`px-3 py-2 text-xs font-medium border-t border-[#2a2a4a] ${leftTab === 'blocks' ? 'text-white bg-[#1a1a2e]' : 'text-slate-400 hover:text-white hover:bg-[#141428]'}`}
                            >
                                Blocks
                            </button>
                            <button
                                onClick={() => setLeftTab('files')}
                                className={`px-3 py-2 text-xs font-medium border-t border-[#2a2a4a] ${leftTab === 'files' ? 'text-white bg-[#1a1a2e]' : 'text-slate-400 hover:text-white hover:bg-[#141428]'}`}
                            >
                                Files
                            </button>
                        </div>
                    </div>

                    {leftTab === 'blocks' && (
                        <>
                            <div id="blocks-container" className="flex-1 overflow-y-auto p-3"></div>

                            {/* Asset Manager Button in Left Sidebar */}
                            <button
                                onClick={() => setIsAssetManagerOpen(true)}
                                className="m-3 p-3 flex items-center gap-2 text-sm text-slate-400 hover:text-white bg-[#0a0a1a] hover:bg-[#2a2a4a] border border-[#2a2a4a] rounded-lg transition-colors"
                            >
                                <Image size={16} />
                                <span>Asset Manager</span>
                            </button>
                        </>
                    )}

                    {leftTab === 'files' && (
                        <div className="flex-1 overflow-y-auto p-3">
                            {!projectId && (
                                <div className="text-xs text-slate-400">Select a project to view files.</div>
                            )}
                            {projectId && vfsLoading && (
                                <div className="text-xs text-slate-400">Loading files...</div>
                            )}
                            {projectId && vfsError && (
                                <div className="text-xs text-red-400">{vfsError}</div>
                            )}
                            {projectId && !vfsLoading && !vfsError && vfsTree && (
                                <FileTree
                                    tree={vfsTree}
                                    selectedPath={vfsSelectedPath}
                                    onFileSelect={handleFileSelect}
                                    onFileAction={handleFileAction}
                                    currentFileId={currentFileId}
                                    onFileMove={handleFileMove}
                                />
                            )}
                            {projectId && !vfsLoading && !vfsError && !vfsTree && (
                                <div className="text-xs text-slate-400">No files found.</div>
                            )}
                        </div>
                    )}
                </aside>

                {/* Canvas */}
                <main
                    className={`flex-1 relative bg-[#0a0a1a] transition-all duration-300 ${previewMode ? 'z-[100]' : ''}`}
                    style={!previewMode ? { backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(99, 102, 241, 0.1) 1px, transparent 0)', backgroundSize: '20px 20px' } : {}}
                >
                    <div ref={editorRef} id="gjs" className="h-full border-none"></div>
                </main>

                {/* Right Sidebar - Styles/Traits/Layers/Logic */}
                <aside className={`w-[300px] bg-[#1a1a2e] border-l border-[#2a2a4a] flex flex-col transition-all duration-300 ${previewMode ? 'hidden' : ''}`}>
                    <div className="grid grid-cols-3 border-b border-[#2a2a4a] bg-[#0a0a1a]">
                        <TabBtn
                            active={activeTab === 'styles'}
                            icon={<Paintbrush size={14} />}
                            label="Styles"
                            onClick={() => handleTabClick('styles')}
                        />
                        <TabBtn
                            active={activeTab === 'traits'}
                            icon={<Cog size={14} />}
                            label="Settings"
                            onClick={() => handleTabClick('traits')}
                        />
                        <TabBtn
                            active={activeTab === 'layers'}
                            icon={<Layers size={14} />}
                            label="Layers"
                            onClick={() => handleTabClick('layers')}
                        />
                        <TabBtn
                            active={activeTab === 'logic'}
                            icon={<CircuitBoard size={14} />}
                            label="Logic"
                            onClick={() => handleTabClick('logic')}
                        />
                        <TabBtn
                            active={activeTab === 'symbols'}
                            icon={<Package size={14} />}
                            label="Symbols"
                            onClick={() => handleTabClick('symbols')}
                        />
                        <TabBtn
                            active={activeTab === 'pages'}
                            icon={<FileStack size={14} />}
                            label="Pages"
                            onClick={() => handleTabClick('pages')}
                        />
                        <TabBtn
                            active={activeTab === 'layout'}
                            icon={<LayoutTemplate size={14} />}
                            label="Layout"
                            onClick={() => handleTabClick('layout')}
                        />
                        <TabBtn
                            active={activeTab === 'data'}
                            icon={<Database size={14} />}
                            label="Data"
                            onClick={() => handleTabClick('data')}
                        />
                        <TabBtn
                            active={activeTab === 'history'}
                            icon={<History size={14} />}
                            label="History"
                            onClick={() => handleTabClick('history')}
                        />
                        <TabBtn
                            active={activeTab === 'collab'}
                            icon={<Users size={14} />}
                            label="Collab"
                            onClick={() => handleTabClick('collab')}
                        />
                        <TabBtn
                            active={activeTab === 'code'}
                            icon={<Code size={14} />}
                            label="Code"
                            onClick={() => handleTabClick('code')}
                        />
                        <TabBtn
                            active={activeTab === 'commerce'}
                            icon={<ShoppingBag size={14} />}
                            label="Commerce"
                            onClick={() => handleTabClick('commerce')}
                        />
                        <TabBtn
                            active={activeTab === 'publish'}
                            icon={<Cloud size={14} />}
                            label="Publish"
                            onClick={() => handleTabClick('publish')}
                        />
                        <TabBtn
                            active={activeTab === 'analytics'}
                            icon={<BarChart3 size={14} />}
                            label="Analytics"
                            onClick={() => handleTabClick('analytics')}
                        />
                        <TabBtn
                            active={activeTab === 'a11y'}
                            icon={<ShieldCheck size={14} />}
                            label="A11y"
                            onClick={() => handleTabClick('a11y')}
                        />
                        <TabBtn
                            active={activeTab === 'market'}
                            icon={<Store size={14} />}
                            label="Market"
                            onClick={() => handleTabClick('market')}
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {/* Styles Tab */}
                        <div className={activeTab === 'styles' ? '' : 'hidden'}>
                            <div id="selectors-container" className="p-3"></div>
                            {/* GrapesJS Style Manager Container */}
                            <div id="styles-container"></div>
                            <AutoLayoutPanel editor={editor} />
                            <StyleInspector editor={editor} />
                        </div>

                        {/* Settings/Traits Tab - Using new PropertyEditor */}
                        <div className={activeTab === 'traits' ? 'h-full' : 'hidden'}>
                            {/* GrapesJS Trait Manager Container */}
                            <div id="traits-container"></div>
                            <PropertyEditor editor={editor} />
                        </div>

                        {/* Layers Tab */}
                        <div id="layers-container" className={activeTab === 'layers' ? 'p-3' : 'hidden'}></div>

                        {/* Logic Tab */}
                        <div className={activeTab === 'logic' ? 'h-full' : 'hidden'}>
                            <LogicPanel editor={editor} />
                        </div>

                        {/* Symbols Tab */}
                        <div className={activeTab === 'symbols' ? 'h-full' : 'hidden'}>
                            <SymbolPanel editor={editor} />
                        </div>

                        {/* Pages Tab */}
                        <div className={activeTab === 'pages' ? 'h-full' : 'hidden'}>
                            <PageManager
                                projectId={projectId}
                                currentPageId={currentPageId}
                                onPageSelect={handlePageSelect}
                                onPageCreate={handlePageCreate}
                            />
                        </div>

                        {/* Layout Tab */}
                        <div className={activeTab === 'layout' ? 'h-full' : 'hidden'}>
                            <LayoutPanel />
                        </div>

                        {/* Data Model Tab */}
                        <div className={activeTab === 'data' ? 'h-full' : 'hidden'}>
                            <DataModelPanel />
                        </div>

                        {/* History Tab */}
                        <div className={activeTab === 'history' ? 'h-full' : 'hidden'}>
                            <VersionHistoryPanel fileId={currentFileId} />
                        </div>

                        {/* Collaboration Tab */}
                        <div className={activeTab === 'collab' ? 'h-full' : 'hidden'}>
                            <CollaborationPanel />
                        </div>

                        {/* Code Injection Tab */}
                        <div className={activeTab === 'code' ? 'h-full' : 'hidden'}>
                            <CodeInjectionPanel />
                        </div>

                        {/* Commerce Tab */}
                        <div className={activeTab === 'commerce' ? 'h-full' : 'hidden'}>
                            <EcommercePanel />
                        </div>

                        {/* Publishing Tab */}
                        <div className={activeTab === 'publish' ? 'h-full' : 'hidden'}>
                            <PublishingPanel editor={editor} />
                        </div>

                        {/* Analytics Tab */}
                        <div className={activeTab === 'analytics' ? 'h-full' : 'hidden'}>
                            <AnalyticsPanel />
                        </div>

                        {/* Accessibility Tab */}
                        <div className={activeTab === 'a11y' ? 'h-full' : 'hidden'}>
                            <AccessibilityPanel editor={editor} />
                        </div>

                        {/* Marketplace Tab */}
                        <div className={activeTab === 'market' ? 'h-full' : 'hidden'}>
                            <MarketplacePanel editor={editor} currentPageId={currentPageId} />
                        </div>
                    </div>
                </aside>
            </div>

            {/* Asset Manager Modal */}
            <AssetManager
                editor={editor}
                isOpen={isAssetManagerOpen}
                onClose={() => setIsAssetManagerOpen(false)}
                onSelect={handleAssetSelect}
            />

            {/* Exit Preview Button - Rendered via Portal for guaranteed visibility */}
            {previewMode && createPortal(
                <button
                    onClick={() => {
                        editor?.stopCommand('core:preview');
                    }}
                    className="fixed bottom-6 right-6 flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg hover:shadow-indigo-500/40 transition-all font-medium"
                    style={{ zIndex: 2147483647, pointerEvents: 'auto' }}
                >
                    <EyeOff size={18} />
                    <span>Exit Preview</span>
                </button>,
                document.body
            )}
        </div>
    );
};

const TabBtn = ({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${active
            ? 'text-indigo-500 border-indigo-500 bg-[#1a1a2e]'
            : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
    >
        {icon} {label}
    </button>
);
