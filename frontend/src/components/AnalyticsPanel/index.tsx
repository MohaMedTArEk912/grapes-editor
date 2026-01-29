import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Flame, ToggleLeft, ToggleRight, Plus, X } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import {
    getSummary,
    getHeatmap,
    getExperiments,
    createExperiment,
    getExperimentStats,
    Experiment,
} from '../../services/analyticsService';

export const AnalyticsPanel: React.FC = () => {
    const { currentProject } = useProject();
    const projectId = currentProject?._id || '';
    const [summary, setSummary] = useState<{ totals: number; byType: Array<{ _id: string; count: number }>; byPage: Array<{ _id: string; events: number; pageViews: number; clicks: number; formSubmits: number }> } | null>(null);
    const [heatmap, setHeatmap] = useState<{ grid: number; points: Array<{ _id: { x: number; y: number }; count: number }> } | null>(null);
    const [experiments, setExperiments] = useState<Experiment[]>([]);
    const [experimentStats, setExperimentStats] = useState<Record<string, Array<{ _id: string; events: number }>>>({});
    const [pageId, setPageId] = useState('');
    const [trackingEnabled, setTrackingEnabled] = useState<boolean>(() => localStorage.getItem('analytics_tracking') === 'true');
    const [activeTab, setActiveTab] = useState<'summary' | 'heatmap' | 'experiments' | 'tracking'>('summary');
    const [showCreate, setShowCreate] = useState(false);
    const [expName, setExpName] = useState('');
    const [expVariants, setExpVariants] = useState('A:50,B:50');
    const [error, setError] = useState<string | null>(null);

    const loadSummary = useCallback(async () => {
        if (!projectId) return;
        try {
            const data = await getSummary(projectId);
            setSummary(data);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load summary');
        }
    }, [projectId]);

    const loadHeatmap = useCallback(async () => {
        if (!projectId) return;
        try {
            const data = await getHeatmap(projectId, pageId || undefined, 24);
            setHeatmap(data);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load heatmap');
        }
    }, [projectId, pageId]);

    const loadExperiments = useCallback(async () => {
        if (!projectId) return;
        try {
            const data = await getExperiments(projectId);
            setExperiments(data || []);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load experiments');
        }
    }, [projectId]);

    useEffect(() => {
        loadSummary();
        loadHeatmap();
        loadExperiments();
    }, [loadSummary, loadHeatmap, loadExperiments]);

    const toggleTracking = () => {
        const next = !trackingEnabled;
        localStorage.setItem('analytics_tracking', String(next));
        setTrackingEnabled(next);
        window.dispatchEvent(new CustomEvent('analytics-tracking-changed'));
    };

    const handleCreateExperiment = async () => {
        if (!projectId || !expName.trim()) return;
        try {
            const variants = expVariants.split(',').map((entry) => {
                const [name, weight] = entry.split(':').map((value) => value.trim());
                return { name, weight: Number(weight || 0) };
            });
            const created = await createExperiment({
                projectId,
                name: expName.trim(),
                variants,
            });
            setExperiments([created, ...experiments]);
            setShowCreate(false);
            setExpName('');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to create experiment');
        }
    };

    const handleLoadStats = async (experimentId: string) => {
        try {
            const data = await getExperimentStats(experimentId);
            setExperimentStats((prev) => ({ ...prev, [experimentId]: data.stats || [] }));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load stats');
        }
    };

    const heatmapCells = useMemo(() => {
        if (!heatmap) return [];
        const max = Math.max(1, ...heatmap.points.map((point) => point.count));
        return heatmap.points.map((point) => ({
            ...point,
            intensity: point.count / max,
        }));
    }, [heatmap]);

    if (!projectId) {
        return <div className="p-4 text-slate-400 text-sm">Select a project to view analytics.</div>;
    }

    return (
        <div className="p-4 text-slate-200">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <BarChart3 size={18} />
                    Analytics
                </h3>
                <button
                    onClick={toggleTracking}
                    className="p-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
                    aria-label="Toggle tracking"
                >
                    {trackingEnabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
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
                {(['summary', 'heatmap', 'experiments', 'tracking'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-3 py-1 rounded border transition-colors ${
                            activeTab === tab
                                ? 'bg-indigo-500/20 text-indigo-200 border-indigo-500/40'
                                : 'bg-[#0a0a1a] text-slate-400 border-[#2a2a4a] hover:text-white'
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {activeTab === 'summary' && summary && (
                <div className="space-y-3">
                    <div className="text-sm text-slate-300">Total events: {summary.totals}</div>
                    <div className="grid grid-cols-2 gap-2">
                        {summary.byType.map((item) => (
                            <div key={item._id} className="bg-[#141428] border border-[#2a2a4a] rounded p-2 text-xs text-slate-300">
                                {item._id}: {item.count}
                            </div>
                        ))}
                    </div>
                    <div className="text-xs text-slate-400">Per page</div>
                    <div className="space-y-2">
                        {summary.byPage.map((page) => (
                            <div key={page._id || 'unknown'} className="bg-[#141428] border border-[#2a2a4a] rounded p-2 text-xs text-slate-300">
                                <div>Page: {page._id || 'Unknown'}</div>
                                <div>Views: {page.pageViews} · Clicks: {page.clicks} · Forms: {page.formSubmits}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'heatmap' && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <input
                            value={pageId}
                            onChange={(e) => setPageId(e.target.value)}
                            className="bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white"
                            placeholder="Page id (optional)"
                        />
                        <button
                            onClick={loadHeatmap}
                            className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600"
                        >
                            Load
                        </button>
                    </div>
                    {heatmap && (
                        <div className="relative h-64 border border-[#2a2a4a] rounded bg-[#0a0a1a] overflow-hidden">
                            {heatmapCells.map((point) => (
                                <div
                                    key={`${point._id.x}-${point._id.y}`}
                                    className="absolute rounded-full"
                                    style={{
                                        left: point._id.x * heatmap.grid,
                                        top: point._id.y * heatmap.grid,
                                        width: heatmap.grid,
                                        height: heatmap.grid,
                                        backgroundColor: `rgba(239, 68, 68, ${0.1 + point.intensity * 0.7})`,
                                    }}
                                />
                            ))}
                            {heatmap.points.length === 0 && (
                                <div className="text-xs text-slate-500 flex items-center justify-center h-full">
                                    No clicks recorded yet.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'experiments' && (
                <div className="space-y-3">
                    <button
                        onClick={() => setShowCreate(true)}
                        className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600"
                    >
                        <Plus size={12} className="inline mr-1" />
                        New experiment
                    </button>
                    <div className="space-y-2">
                        {experiments.map((experiment) => (
                            <div key={experiment._id} className="bg-[#141428] border border-[#2a2a4a] rounded p-3 text-xs text-slate-300">
                                <div className="flex items-center justify-between">
                                    <div className="font-medium">{experiment.name}</div>
                                    <span className="text-slate-400">{experiment.status}</span>
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                    <button
                                        onClick={() => handleLoadStats(experiment._id)}
                                        className="px-2 py-1 text-[11px] bg-[#0a0a1a] border border-[#2a2a4a] rounded"
                                    >
                                        Load stats
                                    </button>
                                </div>
                                {experimentStats[experiment._id] && (
                                    <div className="mt-2 space-y-1">
                                        {experimentStats[experiment._id].map((stat) => (
                                            <div key={stat._id || 'unknown'}>
                                                {stat._id || 'unknown'}: {stat.events}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'tracking' && (
                <div className="space-y-3 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                        <Flame size={14} />
                        Tracking is {trackingEnabled ? 'enabled' : 'disabled'} for canvas interactions.
                    </div>
                    <div>
                        POST endpoint: /api/analytics/track
                    </div>
                    <pre className="bg-[#0a0a1a] border border-[#2a2a4a] rounded p-2 overflow-auto text-[11px]">
{JSON.stringify(
    {
        projectId,
        pageId: 'pageId',
        type: 'click',
        x: 120,
        y: 64,
        element: 'button',
    },
    null,
    2
)}
                    </pre>
                </div>
            )}

            {showCreate && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
                    <div className="w-full max-w-md bg-[#101020] border border-[#2a2a4a] rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold">New experiment</h4>
                            <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Name</label>
                                <input
                                    value={expName}
                                    onChange={(e) => setExpName(e.target.value)}
                                    className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Variants (name:weight)</label>
                                <input
                                    value={expVariants}
                                    onChange={(e) => setExpVariants(e.target.value)}
                                    className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                    placeholder="A:50,B:50"
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setShowCreate(false)}
                                    className="px-3 py-1 text-xs text-slate-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateExperiment}
                                    className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600"
                                >
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
