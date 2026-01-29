import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPage, Page } from '../../services/pageService';
import { ProjectService, ProjectData } from '../../services/projectService';

const transitionStyles = (transition: Page['transition'] | undefined) => {
    if (!transition || transition.type === 'none') return {};
    const duration = transition.duration || 300;
    if (transition.type === 'fade') {
        return { animation: `fadeIn ${duration}ms ease` };
    }
    if (transition.type === 'slide') {
        return { animation: `slideIn ${duration}ms ease` };
    }
    if (transition.type === 'zoom') {
        return { animation: `zoomIn ${duration}ms ease` };
    }
    return {};
};

export const PagePreview: React.FC = () => {
    const { projectId, pageId } = useParams();
    const [project, setProject] = useState<ProjectData | null>(null);
    const [page, setPage] = useState<Page | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!projectId || !pageId) return;
        const load = async () => {
            setLoading(true);
            const proj = await ProjectService.getProjectById(projectId);
            const pg = await getPage(projectId, pageId);
            setProject(proj);
            setPage(pg);
            setLoading(false);
        };
        load();
    }, [projectId, pageId]);

    const content = useMemo(() => {
        if (!page?.content) return { html: '', css: '' };
        const c = page.content as { html?: string; css?: string };
        return { html: c.html || '', css: c.css || '' };
    }, [page]);

    if (loading) {
        return <div className="p-10 text-slate-500">Loading preview...</div>;
    }

    return (
        <div className="min-h-screen bg-white">
            <style>{`
                ${project?.headerCss || ''}
                ${project?.footerCss || ''}
                ${content.css || ''}
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                @keyframes zoomIn { from { transform: scale(0.98); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            `}</style>
            <div dangerouslySetInnerHTML={{ __html: project?.headerHtml || '' }} />
            <main style={transitionStyles(page?.transition)} dangerouslySetInnerHTML={{ __html: content.html }} />
            <div dangerouslySetInnerHTML={{ __html: project?.footerHtml || '' }} />
        </div>
    );
};
