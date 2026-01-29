import React, { useCallback, useEffect, useState } from 'react';
import { Clock, RotateCcw, Plus, X, GitCompare, Undo2, Redo2 } from 'lucide-react';
import {
    createVersion,
    getVersions,
    restoreVersion,
    VFSVersion,
    getVersionDiff,
    getUndoHistory,
    undoFileAction,
    redoFileAction,
    UndoAction,
    UndoStats,
    VersionDiff,
} from '../../services/vfsService';
import { useProject } from '../../context/ProjectContext';

const getErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error) return err.message;
    return fallback;
};

interface VersionHistoryPanelProps {
    fileId?: string;
}

export const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({ fileId }) => {
    const { currentProject } = useProject();
    const projectId = currentProject?._id || '';

    const [versions, setVersions] = useState<VFSVersion[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [label, setLabel] = useState('');
    const [undoHistory, setUndoHistory] = useState<UndoAction[]>([]);
    const [undoStats, setUndoStats] = useState<UndoStats | null>(null);
    const [diffOpen, setDiffOpen] = useState(false);
    const [diffLoading, setDiffLoading] = useState(false);
    const [diffData, setDiffData] = useState<VersionDiff | null>(null);
    const [diffVersion, setDiffVersion] = useState<VFSVersion | null>(null);

    const loadVersions = useCallback(async () => {
        if (!projectId) return;
        try {
            setLoading(true);
            const result = await getVersions(projectId);
            setVersions(result.versions || []);
            setError(null);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load versions'));
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        loadVersions();
    }, [loadVersions]);

    const loadUndoHistory = useCallback(async () => {
        if (!fileId) {
            setUndoHistory([]);
            setUndoStats(null);
            return;
        }
        try {
            const result = await getUndoHistory(fileId, 12);
            setUndoHistory(result.history || []);
            setUndoStats(result.stats || null);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load undo history'));
        }
    }, [fileId]);

    useEffect(() => {
        loadUndoHistory();
    }, [loadUndoHistory]);

    const handleCreate = async () => {
        if (!projectId) return;
        try {
            await createVersion(projectId, label || undefined);
            setLabel('');
            await loadVersions();
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to create version'));
        }
    };

    const handleRestore = async (versionId: string) => {
        if (!confirm('Restore this version? This will overwrite current files.')) return;
        try {
            await restoreVersion(versionId);
            await loadVersions();
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to restore version'));
        }
    };

    const handleUndo = async () => {
        if (!fileId) return;
        try {
            await undoFileAction(fileId);
            await loadUndoHistory();
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to undo'));
        }
    };

    const handleRedo = async () => {
        if (!fileId) return;
        try {
            await redoFileAction(fileId);
            await loadUndoHistory();
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to redo'));
        }
    };

    const handleDiff = async (version: VFSVersion) => {
        try {
            setDiffOpen(true);
            setDiffLoading(true);
            setDiffVersion(version);
            const result = await getVersionDiff(version._id, 'current');
            setDiffData(result.diff || null);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to generate diff'));
        } finally {
            setDiffLoading(false);
        }
    };

    if (!projectId) {
        return <div className="p-4 text-slate-400 text-sm">Select a project to view versions.</div>;
    }

    return (
        <div className="p-4 text-slate-200">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Clock size={18} />
                    Versions
                </h3>
                <button
                    onClick={handleCreate}
                    className="p-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
                    aria-label="Create version"
                >
                    <Plus size={16} />
                </button>
            </div>

            <div className="mb-4 rounded-lg border border-[#2a2a4a] bg-[#141428] p-3">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-xs text-slate-400">Undo stack</div>
                        <div className="text-sm text-slate-200">
                            {fileId ? 'Active file' : 'Select a file to enable'}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleUndo}
                            disabled={!fileId || (undoStats?.undoCount ?? 0) === 0}
                            className="p-2 rounded bg-[#0a0a1a] border border-[#2a2a4a] text-slate-300 disabled:opacity-40"
                            title="Undo"
                        >
                            <Undo2 size={14} />
                        </button>
                        <button
                            onClick={handleRedo}
                            disabled={!fileId || (undoStats?.redoCount ?? 0) === 0}
                            className="p-2 rounded bg-[#0a0a1a] border border-[#2a2a4a] text-slate-300 disabled:opacity-40"
                            title="Redo"
                        >
                            <Redo2 size={14} />
                        </button>
                    </div>
                </div>
                {fileId && (
                    <div className="mt-2 text-[11px] text-slate-400">
                        Undo: {undoStats?.undoCount ?? 0} · Redo: {undoStats?.redoCount ?? 0}
                    </div>
                )}
                {fileId && undoHistory.length > 0 && (
                    <div className="mt-2 space-y-1 max-h-24 overflow-auto">
                        {undoHistory.map((action) => (
                            <div key={action.id} className="text-[11px] text-slate-300">
                                {action.description}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="mb-3">
                <label className="block text-xs text-slate-400 mb-1">Version label (optional)</label>
                <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                    placeholder="Release v1"
                />
            </div>

            {error && (
                <div className="mb-3 p-2 bg-red-500/20 text-red-300 rounded text-sm flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="text-red-300">
                        <X size={14} />
                    </button>
                </div>
            )}

            {loading && versions.length === 0 && (
                <div className="text-slate-400 text-sm">Loading versions...</div>
            )}

            {!loading && versions.length === 0 && (
                <div className="text-slate-400 text-sm">No versions yet.</div>
            )}

            <div className="space-y-2 max-h-[50vh] overflow-auto">
                {versions.map((version) => (
                    <div
                        key={version._id}
                        className="flex items-center justify-between p-3 rounded-lg bg-[#141428] border border-[#2a2a4a]"
                    >
                        <div className="min-w-0">
                            <div className="font-medium truncate">{version.label || 'Untitled Version'}</div>
                            <div className="text-xs text-slate-400">
                                {new Date(version.createdAt).toLocaleString()} · {version.trigger}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleDiff(version)}
                                className="text-slate-400 hover:text-indigo-200 p-1"
                                title="View diff"
                            >
                                <GitCompare size={16} />
                            </button>
                            <button
                                onClick={() => handleRestore(version._id)}
                                className="text-indigo-400 hover:text-indigo-300 p-1"
                                title="Rollback to version"
                            >
                                <RotateCcw size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {diffOpen && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60">
                    <div className="w-full max-w-2xl bg-[#101020] border border-[#2a2a4a] rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <div className="text-sm font-semibold">Version diff</div>
                                <div className="text-xs text-slate-400">
                                    {diffVersion?.label || 'Untitled Version'} → current
                                </div>
                            </div>
                            <button onClick={() => setDiffOpen(false)} className="text-slate-400 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>
                        {diffLoading && <div className="text-sm text-slate-400">Loading diff…</div>}
                        {!diffLoading && diffData && (
                            <div className="space-y-4 max-h-[60vh] overflow-auto">
                                <div>
                                    <div className="text-xs text-slate-400 mb-1">Files</div>
                                    <div className="text-[11px] text-slate-300">
                                        Added: {diffData.files.added.length} · Removed: {diffData.files.removed.length} · Changed: {diffData.files.changed.length}
                                    </div>
                                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-300">
                                        {diffData.files.added.map((file, index) => (
                                            <div key={`fa-${index}`} className="bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1">
                                                + {file.path || file.name}
                                            </div>
                                        ))}
                                        {diffData.files.removed.map((file, index) => (
                                            <div key={`fr-${index}`} className="bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1">
                                                - {file.path || file.name}
                                            </div>
                                        ))}
                                        {diffData.files.changed.map((file, index) => (
                                            <div key={`fc-${index}`} className="bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1">
                                                ~ {file.path || file.name}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-400 mb-1">Blocks</div>
                                    <div className="text-[11px] text-slate-300">
                                        Added: {diffData.blocks.added.length} · Removed: {diffData.blocks.removed.length} · Changed: {diffData.blocks.changed.length}
                                    </div>
                                </div>
                            </div>
                        )}
                        {!diffLoading && !diffData && (
                            <div className="text-sm text-slate-400">No diff available.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
