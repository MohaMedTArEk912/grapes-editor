const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface AnalyticsSummary {
    totals: number;
    byType: Array<{ _id: string; count: number }>;
    byPage: Array<{ _id: string; events: number; pageViews: number; clicks: number; formSubmits: number }>;
}

export interface HeatmapPoint {
    _id: { x: number; y: number };
    count: number;
}

export interface HeatmapResult {
    grid: number;
    points: HeatmapPoint[];
}

export interface ExperimentVariant {
    name: string;
    weight: number;
    content?: { html?: string; css?: string };
}

export interface Experiment {
    _id: string;
    projectId: string;
    name: string;
    pageId?: string;
    status: 'draft' | 'running' | 'paused' | 'completed';
    variants: ExperimentVariant[];
    createdAt: string;
    updatedAt: string;
}

const getAuthHeaders = (): HeadersInit => {
    const userStr = localStorage.getItem('grapes_user');
    const user = userStr ? JSON.parse(userStr) : null;
    const token = user?.token;

    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
};

const handleResponse = async <T>(response: Response): Promise<T> => {
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data?.message || 'Request failed');
    }
    return data;
};

export const trackEvent = async (payload: {
    projectId: string;
    pageId?: string;
    type: 'page_view' | 'click' | 'form_submit' | 'custom';
    x?: number;
    y?: number;
    element?: string;
    meta?: Record<string, unknown>;
    experimentId?: string;
    variant?: string;
}) => {
    const response = await fetch(`${API_URL}/analytics/track`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};

export const getSummary = async (projectId: string): Promise<AnalyticsSummary> => {
    const response = await fetch(`${API_URL}/analytics/summary/${projectId}`, {
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const getHeatmap = async (projectId: string, pageId?: string, grid = 24): Promise<HeatmapResult> => {
    const query = new URLSearchParams();
    if (pageId) query.set('pageId', pageId);
    query.set('grid', String(grid));
    const response = await fetch(`${API_URL}/analytics/heatmap/${projectId}?${query.toString()}`, {
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const getExperiments = async (projectId: string): Promise<Experiment[]> => {
    const response = await fetch(`${API_URL}/analytics/experiments/${projectId}`, {
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const createExperiment = async (payload: {
    projectId: string;
    name: string;
    pageId?: string;
    status?: Experiment['status'];
    variants: ExperimentVariant[];
}): Promise<Experiment> => {
    const response = await fetch(`${API_URL}/analytics/experiments`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};

export const updateExperiment = async (
    experimentId: string,
    payload: Partial<Experiment>
): Promise<Experiment> => {
    const response = await fetch(`${API_URL}/analytics/experiments/${experimentId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};

export const deleteExperiment = async (experimentId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/analytics/experiments/${experimentId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    await handleResponse(response);
};

export const getExperimentStats = async (experimentId: string): Promise<{ experimentId: string; stats: Array<{ _id: string; events: number }> }> => {
    const response = await fetch(`${API_URL}/analytics/experiments/${experimentId}/stats`, {
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};
