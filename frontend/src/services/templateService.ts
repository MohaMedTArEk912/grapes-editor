const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface TemplateContent {
    html?: string;
    css?: string;
}

export interface Template {
    _id: string;
    projectId: string;
    name: string;
    description?: string;
    type: 'page' | 'block';
    tags: string[];
    status: 'private' | 'public';
    previewImage?: string;
    content: TemplateContent;
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

export const getTemplates = async (scope: 'public' | 'project', projectId?: string): Promise<Template[]> => {
    const query = new URLSearchParams();
    query.set('scope', scope);
    if (projectId) query.set('projectId', projectId);
    const response = await fetch(`${API_URL}/templates?${query.toString()}`, {
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const createTemplate = async (payload: {
    projectId: string;
    name: string;
    description?: string;
    type: 'page' | 'block';
    tags?: string[];
    previewImage?: string;
    content?: TemplateContent;
    status?: 'private' | 'public';
}): Promise<Template> => {
    const response = await fetch(`${API_URL}/templates`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};

export const updateTemplate = async (
    templateId: string,
    payload: Partial<Template>
): Promise<Template> => {
    const response = await fetch(`${API_URL}/templates/${templateId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};

export const deleteTemplate = async (templateId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/templates/${templateId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    await handleResponse(response);
};

export const publishTemplate = async (templateId: string, status: 'private' | 'public'): Promise<Template> => {
    const response = await fetch(`${API_URL}/templates/${templateId}/publish`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status }),
    });
    return handleResponse(response);
};
