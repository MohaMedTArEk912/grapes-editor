import React, { useEffect, useState } from 'react';
import { LayoutTemplate, Save } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { ProjectService, ProjectData } from '../../services/projectService';

export const LayoutPanel: React.FC = () => {
    const { currentProject, setCurrentProject } = useProject();
    const [headerHtml, setHeaderHtml] = useState('');
    const [headerCss, setHeaderCss] = useState('');
    const [footerHtml, setFooterHtml] = useState('');
    const [footerCss, setFooterCss] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setHeaderHtml(currentProject?.headerHtml || '');
        setHeaderCss(currentProject?.headerCss || '');
        setFooterHtml(currentProject?.footerHtml || '');
        setFooterCss(currentProject?.footerCss || '');
    }, [currentProject]);

    const handleSave = async () => {
        if (!currentProject?._id) return;
        try {
            setSaving(true);
            const updated = await ProjectService.updateProject(currentProject._id, {
                ...currentProject,
                headerHtml,
                headerCss,
                footerHtml,
                footerCss,
            } as ProjectData);
            setCurrentProject(updated);
        } finally {
            setSaving(false);
        }
    };

    if (!currentProject?._id) {
        return <div className="p-4 text-slate-400 text-sm">Select a project to edit shared layout.</div>;
    }

    return (
        <div className="p-4 text-slate-200">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <LayoutTemplate size={18} />
                    Shared Layout
                </h3>
                <button
                    onClick={handleSave}
                    className="p-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
                    aria-label="Save shared layout"
                    disabled={saving}
                >
                    <Save size={16} />
                </button>
            </div>

            <div className="space-y-4">
                <div>
                    <div className="text-xs text-slate-400 mb-1">Header HTML</div>
                    <textarea
                        value={headerHtml}
                        onChange={(e) => setHeaderHtml(e.target.value)}
                        className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white h-24"
                    />
                </div>
                <div>
                    <div className="text-xs text-slate-400 mb-1">Header CSS</div>
                    <textarea
                        value={headerCss}
                        onChange={(e) => setHeaderCss(e.target.value)}
                        className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white h-20"
                    />
                </div>
                <div>
                    <div className="text-xs text-slate-400 mb-1">Footer HTML</div>
                    <textarea
                        value={footerHtml}
                        onChange={(e) => setFooterHtml(e.target.value)}
                        className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white h-24"
                    />
                </div>
                <div>
                    <div className="text-xs text-slate-400 mb-1">Footer CSS</div>
                    <textarea
                        value={footerCss}
                        onChange={(e) => setFooterCss(e.target.value)}
                        className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white h-20"
                    />
                </div>
            </div>
        </div>
    );
};
