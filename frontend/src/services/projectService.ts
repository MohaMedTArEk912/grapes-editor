import { ProjectSchema } from '../utils/schema';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface ProjectData {
    _id?: string;
    name: string;
    slug?: string;
    content: any[]; // Components JSON
    styles: string; // CSS
    assets: any[];
    headerHtml?: string;
    headerCss?: string;
    footerHtml?: string;
    footerCss?: string;
    customDomain?: string;
    domainProvider?: 'vercel' | 'netlify';
    domainStatus?: 'pending' | 'provisioned' | 'verified' | 'failed';
    sslStatus?: 'pending' | 'active' | 'failed';
    netlifySiteId?: string;
    vercelProjectName?: string;
    updatedAt?: string;
}

const getConfig = () => {
    const user = JSON.parse(localStorage.getItem('grapes_user') || 'null');
    return {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': user?.token ? `Bearer ${user.token}` : '',
        }
    };
};

export const ProjectService = {
    async getAllProjects(): Promise<ProjectData[]> {
        const response = await fetch(`${API_URL}/projects`, getConfig());
        if (!response.ok) throw new Error('Failed to fetch projects');
        return response.json();
    },

    async getProjectById(id: string): Promise<ProjectData> {
        const response = await fetch(`${API_URL}/projects/${id}`, getConfig());
        if (!response.ok) throw new Error('Failed to fetch project');
        return response.json();
    },

    async saveProject(data: ProjectData): Promise<ProjectData> {
        const response = await fetch(`${API_URL}/projects`, {
            method: 'POST',
            ...getConfig(),
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to save project');
        return response.json();
    },

    async updateProject(id: string, data: ProjectData): Promise<ProjectData> {
        const response = await fetch(`${API_URL}/projects/${id}`, {
            method: 'PUT',
            ...getConfig(),
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update project');
        return response.json();
    },

    async deleteProject(id: string): Promise<void> {
        const response = await fetch(`${API_URL}/projects/${id}`, {
            method: 'DELETE',
            ...getConfig(),
        });
        if (!response.ok) throw new Error('Failed to delete project');
    }
};
