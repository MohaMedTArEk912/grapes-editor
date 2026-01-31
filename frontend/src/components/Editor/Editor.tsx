import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useGrapes } from '../../hooks/useGrapes';
import { EyeOff, Box, Paintbrush, Cog, Layers, CircuitBoard, Image, Package, FileStack, Files, Database, History, Users, Code, ShoppingBag, Cloud, BarChart3, ShieldCheck, Store, LayoutTemplate } from 'lucide-react';
import { Toolbar } from '../Toolbar';
import { StyleInspector } from '../StyleInspector';
import { LogicPanel } from '../LogicPanel';
import { PropertyEditor } from '../PropertyEditor';
import { AssetManager } from '../AssetManager';
import { AutoLayoutPanel } from '../AutoLayoutPanel';
import { SymbolPanel } from '../SymbolPanel';
import { PageManager } from '../PageManager';
import { SEOPanel, SEOData } from '../SEOPanel';
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
import { LeftRail } from '../LeftRail';
import { LeftPanel } from '../LeftPanel';
import { RightDrawer } from '../RightDrawer';
import { WorkspaceHeader } from '../WorkspaceHeader';
import { StatusBar } from '../StatusBar';
import { EnhancedBlocksPanel } from '../EnhancedBlocksPanel';
import { EnhancedProjectPicker } from '../ProjectManager/EnhancedProjectPicker';
import { RuntimeEngine } from '../../utils/runtime';
import { useLogic } from '../../context/LogicContext';
import { Page, getPage, updatePage } from '../../services/pageService';
import { useProject } from '../../context/ProjectContext';
import { useCollaboration } from '../../context/useCollaboration';
import { trackEvent as trackAnalyticsEvent } from '../../services/analyticsService';
import { usePanelState } from '../../context/PanelStateContext';
import { useBlockUsage } from '../../hooks/useBlockUsage';
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
    const { currentProject, setCurrentProject } = useProject();
    const { panelState, setActiveLeftPanel, setActiveInspectorTab, setRightDrawerOpen } = usePanelState();
    const runtimeRef = useRef<RuntimeEngine | null>(null);
    const saveTimerRef = useRef<number | null>(null);
    const applyingRemoteRef = useRef(false);

    const [previewMode, setPreviewMode] = useState(false);
    const [isAssetManagerOpen, setIsAssetManagerOpen] = useState(false);
    const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false);
    const [currentPageName, setCurrentPageName] = useState<string>('');
    const [uiRefreshEnabled, setUiRefreshEnabled] = useState(() => localStorage.getItem('ui_refresh_enabled') !== 'false');
    const [legacyActiveTab, setLegacyActiveTab] = useState<'styles' | 'traits' | 'layers' | 'logic' | 'symbols' | 'pages' | 'data' | 'history' | 'collab' | 'code' | 'commerce' | 'publish' | 'analytics' | 'a11y' | 'market' | 'layout'>('styles');
    const [legacyLeftTab, setLegacyLeftTab] = useState<'blocks' | 'files'>('blocks');
    const [seoData, setSeoData] = useState<SEOData>({
        title: '',
        description: '',
        keywords: '',
        ogTitle: '',
        ogDescription: '',
        ogImage: '',
        canonicalUrl: '',
        favicon: '',
    });

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
    const { toggleFavorite, trackBlockUsage, isFavorite, getLastUsed } = useBlockUsage(currentProject?._id);
    const {
        setActivePage,
        sendPageUpdate,
        remoteUpdate,
        setSelectedComponentId,
    } = useCollaboration();

    useEffect(() => {
        setCurrentPageId(undefined);
        setCurrentPageName('');
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
        setCurrentPageName(page.name || 'Untitled Page');
        // Load page content into editor
        if (editor) {
            const content = page.content as { html?: string; css?: string } | undefined;
            editor.setComponents(content?.html || '');
            editor.setStyle(content?.css || '');
        }
    }, [editor, currentPageId, saveCurrentPage]);

    const handlePageCreate = useCallback((page: Page) => {
        setCurrentPageId(page._id);
        setCurrentPageName(page.name || 'Untitled Page');
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
                if (uiRefreshEnabled) {
                    setActiveLeftPanel('pages');
                } else {
                    setLegacyActiveTab('pages');
                }
            }
        }
    }, [projectId, handlePageSelect, setActiveLeftPanel, uiRefreshEnabled]);

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
            if (e.ctrlKey && e.shiftKey) {
                const key = e.key.toLowerCase();
                const panelMap: Record<string, typeof panelState.activeLeftPanel> = {
                    p: 'project',
                    g: 'pages',
                    b: 'blocks',
                    f: 'files',
                    a: 'assets',
                    l: 'logic',
                    d: 'data',
                    s: 'seo',
                    u: 'publish',
                    y: 'analytics',
                    x: 'accessibility',
                    m: 'marketplace',
                    t: 'layout',
                    o: 'symbols',
                    h: 'history',
                    c: 'collab',
                    k: 'code',
                    e: 'commerce',
                };

                if (panelMap[key]) {
                    e.preventDefault();
                    setActiveLeftPanel(panelMap[key]);
                    return;
                }
            }

            if (e.ctrlKey && e.altKey) {
                if (e.key === '1') {
                    e.preventDefault();
                    setActiveInspectorTab('styles');
                    setRightDrawerOpen(true);
                    return;
                }
                if (e.key === '2') {
                    e.preventDefault();
                    setActiveInspectorTab('traits');
                    setRightDrawerOpen(true);
                    return;
                }
                if (e.key === '3') {
                    e.preventDefault();
                    setActiveInspectorTab('layers');
                    setRightDrawerOpen(true);
                    return;
                }
            }

            if (e.key === 'Escape') {
                if (editor?.Commands.isActive('preview')) {
                    editor.stopCommand('core:preview');
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [editor, panelState.activeLeftPanel, setActiveInspectorTab, setActiveLeftPanel, setRightDrawerOpen]);

    // Handle asset selection from Asset Manager
    const handleAssetSelect = useCallback((asset: { src: string }) => {
        if (!editor) return;
        const selected = editor.getSelected();
        if (selected && selected.is('image')) {
            selected.set('src', asset.src);
        }
    }, [editor]);

    const normalizeBlockMedia = useCallback((media?: unknown) => {
        let raw: string | undefined;
        if (typeof media === 'string') {
            raw = media;
        } else if (media && typeof media === 'object' && 'outerHTML' in (media as HTMLElement)) {
            raw = (media as HTMLElement).outerHTML;
        }

        if (!raw) return undefined;
        const trimmed = raw.trim();
        if (!trimmed) return undefined;
        if (trimmed.startsWith('data:')) return trimmed;
        if (trimmed.startsWith('<svg') || trimmed.includes('<svg')) {
            return `data:image/svg+xml;utf8,${encodeURIComponent(trimmed)}`;
        }
        return trimmed;
    }, []);

    const blockItems = useMemo(() => {
        if (!editor) return [] as Array<{ id: string; label: string; category: string; media?: string; isFavorite?: boolean; lastUsed?: Date }>;
        const all = editor.BlockManager.getAll();
        return all.map((block: any) => {
            const id = block.getId();
            const category = block.get('category');
            const categoryLabel = typeof category === 'string'
                ? category
                : category?.id || category?.label || 'General';
            return {
                id,
                label: block.get('label') || id,
                category: categoryLabel,
                media: normalizeBlockMedia(block.get('media')),
                isFavorite: isFavorite(id),
                lastUsed: getLastUsed(id),
            };
        });
    }, [editor, isFavorite, getLastUsed, normalizeBlockMedia]);

    const handleBlockAdd = useCallback((block: { id: string }) => {
        if (!editor) return;
        const bmBlock = editor.BlockManager.get(block.id);
        if (!bmBlock) return;
        const content = bmBlock.get('content');
        editor.addComponents(content);
        trackBlockUsage(block.id);
    }, [editor, trackBlockUsage]);

    const leftPanelTitle = useMemo(() => {
        switch (panelState.activeLeftPanel) {
            case 'project': return 'Project';
            case 'pages': return 'Pages';
            case 'blocks': return 'Blocks';
            case 'files': return 'Files';
            case 'assets': return 'Assets';
            case 'logic': return 'Logic';
            case 'data': return 'Data';
            case 'seo': return 'SEO';
            case 'publish': return 'Publish';
            case 'analytics': return 'Analytics';
            case 'accessibility': return 'Accessibility';
            case 'marketplace': return 'Marketplace';
            case 'layout': return 'Layout';
            case 'symbols': return 'Symbols';
            case 'history': return 'History';
            case 'collab': return 'Collaboration';
            case 'code': return 'Code Injection';
            case 'commerce': return 'Commerce';
            default: return '';
        }
    }, [panelState.activeLeftPanel]);

    const leftPanelContent = useMemo(() => {
        switch (panelState.activeLeftPanel) {
            case 'project':
                return (
                    <div className="p-4 space-y-4">
                        <div className="bg-gray-800 rounded-lg p-3">
                            <div className="text-xs text-gray-400">Current Project</div>
                            <div className="text-sm font-semibold text-white mt-1">
                                {currentProject?.name || 'No project selected'}
                            </div>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-xs text-gray-400">UI Refresh</div>
                                    <div className="text-sm text-white">New editor shell</div>
                                </div>
                                <button
                                    onClick={() => {
                                        const next = !uiRefreshEnabled;
                                        localStorage.setItem('ui_refresh_enabled', next ? 'true' : 'false');
                                        setUiRefreshEnabled(next);
                                        window.location.reload();
                                    }}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${uiRefreshEnabled ? 'bg-blue-600' : 'bg-gray-600'}`}
                                    aria-label="Toggle UI refresh"
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${uiRefreshEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                                    />
                                </button>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsProjectPickerOpen(true)}
                            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                        >
                            Open Project Picker
                        </button>
                    </div>
                );
            case 'blocks':
                return (
                    <EnhancedBlocksPanel
                        blocks={blockItems}
                        onBlockAdd={handleBlockAdd}
                        onToggleFavorite={toggleFavorite}
                    />
                );
            case 'files':
                return (
                    <div className="p-3">
                        {!projectId && (
                            <div className="text-xs text-gray-400">Select a project to view files.</div>
                        )}
                        {projectId && vfsLoading && (
                            <div className="text-xs text-gray-400">Loading files...</div>
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
                            <div className="text-xs text-gray-400">No files found.</div>
                        )}
                    </div>
                );
            case 'pages':
                return (
                    <PageManager
                        projectId={projectId}
                        currentPageId={currentPageId}
                        onPageSelect={handlePageSelect}
                        onPageCreate={handlePageCreate}
                    />
                );
            case 'assets':
                return (
                    <div className="p-4">
                        <button
                            onClick={() => setIsAssetManagerOpen(true)}
                            className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
                        >
                            Open Asset Manager
                        </button>
                    </div>
                );
            case 'logic':
                return <LogicPanel editor={editor} />;
            case 'data':
                return <DataModelPanel />;
            case 'seo':
                return <SEOPanel seoData={seoData} onUpdate={setSeoData} />;
            case 'publish':
                return <PublishingPanel editor={editor} />;
            case 'analytics':
                return <AnalyticsPanel />;
            case 'accessibility':
                return <AccessibilityPanel editor={editor} />;
            case 'marketplace':
                return <MarketplacePanel editor={editor} currentPageId={currentPageId} />;
            case 'layout':
                return <LayoutPanel />;
            case 'symbols':
                return <SymbolPanel editor={editor} />;
            case 'history':
                return <VersionHistoryPanel fileId={currentFileId} />;
            case 'collab':
                return <CollaborationPanel />;
            case 'code':
                return <CodeInjectionPanel />;
            case 'commerce':
                return <EcommercePanel />;
            default:
                return null;
        }
    }, [panelState.activeLeftPanel, currentProject, projectId, vfsLoading, vfsError, vfsTree, vfsSelectedPath, currentFileId, currentPageId, editor, blockItems, handleBlockAdd, toggleFavorite, handleFileSelect, handleFileAction, handleFileMove, handlePageSelect, handlePageCreate, seoData]);

    const handlePreviewToggle = useCallback(() => {
        if (!editor) return;
        if (editor.Commands.isActive('preview')) {
            editor.stopCommand('core:preview');
        } else {
            editor.runCommand('core:preview');
        }
    }, [editor]);

    const handleUndo = useCallback(() => {
        editor?.runCommand('core:undo');
    }, [editor]);

    const handleRedo = useCallback(() => {
        editor?.runCommand('core:redo');
    }, [editor]);

    const canUndo = editor?.UndoManager?.hasUndo?.() ?? false;
    const canRedo = editor?.UndoManager?.hasRedo?.() ?? false;

    const currentDevice = useMemo(() => {
        const device = editor?.getDevice?.();
        if (!device) return 'desktop';
        const lower = device.toLowerCase();
        if (lower.includes('tablet')) return 'tablet';
        if (lower.includes('mobile')) return 'mobile';
        return 'desktop';
    }, [editor]);

    const handleDeviceToggle = useCallback((device: 'desktop' | 'tablet' | 'mobile') => {
        if (!editor) return;
        if (device === 'tablet') editor.setDevice('Tablet');
        else if (device === 'mobile') editor.setDevice('Mobile');
        else editor.setDevice('Desktop');
    }, [editor]);

    const handleLegacyTabClick = useCallback((tab: typeof legacyActiveTab) => {
        setLegacyActiveTab(tab);
    }, []);

    const renderLegacyLayout = () => (
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
                            {legacyLeftTab === 'blocks' ? <Box size={14} /> : <Files size={14} />}
                            {legacyLeftTab === 'blocks' ? 'Components & Blocks' : 'Project Files'}
                        </div>
                        <div className="grid grid-cols-2">
                            <button
                                onClick={() => setLegacyLeftTab('blocks')}
                                className={`px-3 py-2 text-xs font-medium border-t border-[#2a2a4a] ${legacyLeftTab === 'blocks' ? 'text-white bg-[#1a1a2e]' : 'text-slate-400 hover:text-white hover:bg-[#141428]'}`}
                            >
                                Blocks
                            </button>
                            <button
                                onClick={() => setLegacyLeftTab('files')}
                                className={`px-3 py-2 text-xs font-medium border-t border-[#2a2a4a] ${legacyLeftTab === 'files' ? 'text-white bg-[#1a1a2e]' : 'text-slate-400 hover:text-white hover:bg-[#141428]'}`}
                            >
                                Files
                            </button>
                        </div>
                    </div>

                    {legacyLeftTab === 'blocks' && (
                        <>
                            <div id="blocks-container" className="flex-1 overflow-y-auto p-3"></div>
                            <button
                                onClick={() => setIsAssetManagerOpen(true)}
                                className="m-3 p-3 flex items-center gap-2 text-sm text-slate-400 hover:text-white bg-[#0a0a1a] hover:bg-[#2a2a4a] border border-[#2a2a4a] rounded-lg transition-colors"
                            >
                                <Image size={16} />
                                <span>Asset Manager</span>
                            </button>
                        </>
                    )}

                    {legacyLeftTab === 'files' && (
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
                        <LegacyTabBtn
                            active={legacyActiveTab === 'styles'}
                            icon={<Paintbrush size={14} />}
                            label="Styles"
                            onClick={() => handleLegacyTabClick('styles')}
                        />
                        <LegacyTabBtn
                            active={legacyActiveTab === 'traits'}
                            icon={<Cog size={14} />}
                            label="Settings"
                            onClick={() => handleLegacyTabClick('traits')}
                        />
                        <LegacyTabBtn
                            active={legacyActiveTab === 'layers'}
                            icon={<Layers size={14} />}
                            label="Layers"
                            onClick={() => handleLegacyTabClick('layers')}
                        />
                        <LegacyTabBtn
                            active={legacyActiveTab === 'logic'}
                            icon={<CircuitBoard size={14} />}
                            label="Logic"
                            onClick={() => handleLegacyTabClick('logic')}
                        />
                        <LegacyTabBtn
                            active={legacyActiveTab === 'symbols'}
                            icon={<Package size={14} />}
                            label="Symbols"
                            onClick={() => handleLegacyTabClick('symbols')}
                        />
                        <LegacyTabBtn
                            active={legacyActiveTab === 'pages'}
                            icon={<FileStack size={14} />}
                            label="Pages"
                            onClick={() => handleLegacyTabClick('pages')}
                        />
                        <LegacyTabBtn
                            active={legacyActiveTab === 'layout'}
                            icon={<LayoutTemplate size={14} />}
                            label="Layout"
                            onClick={() => handleLegacyTabClick('layout')}
                        />
                        <LegacyTabBtn
                            active={legacyActiveTab === 'data'}
                            icon={<Database size={14} />}
                            label="Data"
                            onClick={() => handleLegacyTabClick('data')}
                        />
                        <LegacyTabBtn
                            active={legacyActiveTab === 'history'}
                            icon={<History size={14} />}
                            label="History"
                            onClick={() => handleLegacyTabClick('history')}
                        />
                        <LegacyTabBtn
                            active={legacyActiveTab === 'collab'}
                            icon={<Users size={14} />}
                            label="Collab"
                            onClick={() => handleLegacyTabClick('collab')}
                        />
                        <LegacyTabBtn
                            active={legacyActiveTab === 'code'}
                            icon={<Code size={14} />}
                            label="Code"
                            onClick={() => handleLegacyTabClick('code')}
                        />
                        <LegacyTabBtn
                            active={legacyActiveTab === 'commerce'}
                            icon={<ShoppingBag size={14} />}
                            label="Commerce"
                            onClick={() => handleLegacyTabClick('commerce')}
                        />
                        <LegacyTabBtn
                            active={legacyActiveTab === 'publish'}
                            icon={<Cloud size={14} />}
                            label="Publish"
                            onClick={() => handleLegacyTabClick('publish')}
                        />
                        <LegacyTabBtn
                            active={legacyActiveTab === 'analytics'}
                            icon={<BarChart3 size={14} />}
                            label="Analytics"
                            onClick={() => handleLegacyTabClick('analytics')}
                        />
                        <LegacyTabBtn
                            active={legacyActiveTab === 'a11y'}
                            icon={<ShieldCheck size={14} />}
                            label="A11y"
                            onClick={() => handleLegacyTabClick('a11y')}
                        />
                        <LegacyTabBtn
                            active={legacyActiveTab === 'market'}
                            icon={<Store size={14} />}
                            label="Market"
                            onClick={() => handleLegacyTabClick('market')}
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        <div className={legacyActiveTab === 'styles' ? '' : 'hidden'}>
                            <div id="selectors-container" className="p-3"></div>
                            <div id="styles-container"></div>
                            <AutoLayoutPanel editor={editor} />
                            <StyleInspector editor={editor} />
                        </div>

                        <div className={legacyActiveTab === 'traits' ? 'h-full' : 'hidden'}>
                            <div id="traits-container"></div>
                            <PropertyEditor editor={editor} />
                        </div>

                        <div id="layers-container" className={legacyActiveTab === 'layers' ? 'p-3' : 'hidden'}></div>

                        <div className={legacyActiveTab === 'logic' ? 'h-full' : 'hidden'}>
                            <LogicPanel editor={editor} />
                        </div>

                        <div className={legacyActiveTab === 'symbols' ? 'h-full' : 'hidden'}>
                            <SymbolPanel editor={editor} />
                        </div>

                        <div className={legacyActiveTab === 'pages' ? 'h-full' : 'hidden'}>
                            <PageManager
                                projectId={projectId}
                                currentPageId={currentPageId}
                                onPageSelect={handlePageSelect}
                                onPageCreate={handlePageCreate}
                            />
                        </div>

                        <div className={legacyActiveTab === 'layout' ? 'h-full' : 'hidden'}>
                            <LayoutPanel />
                        </div>

                        <div className={legacyActiveTab === 'data' ? 'h-full' : 'hidden'}>
                            <DataModelPanel />
                        </div>

                        <div className={legacyActiveTab === 'history' ? 'h-full' : 'hidden'}>
                            <VersionHistoryPanel fileId={currentFileId} />
                        </div>

                        <div className={legacyActiveTab === 'collab' ? 'h-full' : 'hidden'}>
                            <CollaborationPanel />
                        </div>

                        <div className={legacyActiveTab === 'code' ? 'h-full' : 'hidden'}>
                            <CodeInjectionPanel />
                        </div>

                        <div className={legacyActiveTab === 'commerce' ? 'h-full' : 'hidden'}>
                            <EcommercePanel />
                        </div>

                        <div className={legacyActiveTab === 'publish' ? 'h-full' : 'hidden'}>
                            <PublishingPanel editor={editor} />
                        </div>

                        <div className={legacyActiveTab === 'analytics' ? 'h-full' : 'hidden'}>
                            <AnalyticsPanel />
                        </div>

                        <div className={legacyActiveTab === 'a11y' ? 'h-full' : 'hidden'}>
                            <AccessibilityPanel editor={editor} />
                        </div>

                        <div className={legacyActiveTab === 'market' ? 'h-full' : 'hidden'}>
                            <MarketplacePanel editor={editor} currentPageId={currentPageId} />
                        </div>
                    </div>
                </aside>
            </div>

            <AssetManager
                editor={editor}
                isOpen={isAssetManagerOpen}
                onClose={() => setIsAssetManagerOpen(false)}
                onSelect={handleAssetSelect}
            />

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

    if (!uiRefreshEnabled) {
        return renderLegacyLayout();
    }

    return (
        <div className="h-screen w-full flex flex-col bg-gray-950 text-slate-200 overflow-hidden relative">
            {/* Loading Overlay */}
            {!editor && (
                <div className="fixed inset-0 bg-gray-950 z-[9999] flex flex-col items-center justify-center">
                    <div className="w-12 h-12 border-4 border-gray-800 border-t-blue-500 rounded-full animate-spin"></div>
                    <p className="mt-4 text-slate-400 text-sm">Loading Editor...</p>
                </div>
            )}

            {!previewMode && (
                <WorkspaceHeader
                    pageName={currentPageName || 'Untitled Page'}
                    onPageNameClick={() => setActiveLeftPanel('pages')}
                    onDeviceToggle={handleDeviceToggle}
                    currentDevice={currentDevice}
                    onPreview={handlePreviewToggle}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    canUndo={canUndo}
                    canRedo={canRedo}
                />
            )}

            <div className="flex-1 flex overflow-hidden">
                {!previewMode && <LeftRail />}

                {!previewMode && panelState.activeLeftPanel && (
                    <LeftPanel title={leftPanelTitle}>
                        {leftPanelContent}
                    </LeftPanel>
                )}

                {/* Canvas */}
                <main
                    className={`flex-1 relative bg-[#0a0a1a] transition-all duration-300 ${previewMode ? 'z-[100]' : ''}`}
                    style={!previewMode ? { backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(99, 102, 241, 0.1) 1px, transparent 0)', backgroundSize: '20px 20px' } : {}}
                >
                    <div ref={editorRef} id="gjs" className="h-full border-none"></div>
                </main>

                {!previewMode && (
                    <RightDrawer
                        stylesContent={
                            <div>
                                <div id="selectors-container" className="p-3"></div>
                                <div id="styles-container"></div>
                                <AutoLayoutPanel editor={editor} />
                                <StyleInspector editor={editor} />
                            </div>
                        }
                        traitsContent={
                            <div className="h-full">
                                <div id="traits-container"></div>
                                <PropertyEditor editor={editor} />
                            </div>
                        }
                        layersContent={<div id="layers-container" className="p-3"></div>}
                    />
                )}
            </div>

            {!previewMode && (
                <StatusBar
                    saveState="saved"
                    syncState="synced"
                />
            )}

            {/* GrapesJS append targets (always mounted) */}
            <div className="hidden">
                <div id="blocks-container"></div>
            </div>

            {/* Asset Manager Modal */}
            <AssetManager
                editor={editor}
                isOpen={isAssetManagerOpen}
                onClose={() => setIsAssetManagerOpen(false)}
                onSelect={handleAssetSelect}
            />

            <EnhancedProjectPicker
                isOpen={isProjectPickerOpen}
                onClose={() => setIsProjectPickerOpen(false)}
                onLoadProject={(project) => {
                    setIsProjectPickerOpen(false);
                    setActiveLeftPanel(null);
                    setRightDrawerOpen(true);
                    if (project) {
                        setCurrentProject(project);
                    }
                }}
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

const LegacyTabBtn = ({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) => (
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
