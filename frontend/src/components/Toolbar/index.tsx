import React from 'react';
import { GrapesEditor } from '../../types/grapes';
import {
    Undo, Redo, Trash2, Code, Eye,
    Maximize, Download, Monitor, Tablet, Smartphone,
    Save, FolderOpen
} from 'lucide-react';
import {
    exportProjectSchema,
    importProjectSchema,
} from '../../utils/schema';
import { generateProjectKey } from '../../utils/generator';
import { saveAs } from 'file-saver';
import { useLogic } from '../../context/LogicContext';
import { ProjectService, ProjectData } from '../../services/projectService';
import { ProjectListModal } from '../ProjectManager/ProjectListModal';

interface ToolbarProps {
    editor: GrapesEditor | null;
    onOpenAssetManager?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ editor, onOpenAssetManager: _onOpenAssetManager }) => {
    const { variables, flows } = useLogic();
    const [activeDevice, setActiveDevice] = React.useState('Desktop');
    const [isLoadModalOpen, setIsLoadModalOpen] = React.useState(false);
    const [currentProject, setCurrentProject] = React.useState<ProjectData | null>(null);

    if (!editor) return null;

    const handleDeviceChange = (device: string) => {
        setActiveDevice(device);
        editor.setDevice(device);
    };

    const handleClear = () => {
        if (confirm('Are you sure you want to clear the canvas?')) {
            editor.DomComponents.clear();
            editor.CssComposer.clear();
            setCurrentProject(null);
        }
    };

    const handleViewCode = () => {
        const html = editor.getHtml();
        const css = editor.getCss();
        editor.Modal.setTitle('HTML & CSS Code')
            .setContent(`
        <div class="p-4 bg-gray-900 text-gray-200 font-mono text-xs overflow-auto max-h-[60vh]">
          <h4 class="text-indigo-500 mb-2">HTML</h4>
          <pre class="bg-gray-800 p-3 rounded mb-4 overflow-x-auto whitespace-pre-wrap">${html.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
          <h4 class="text-indigo-500 mb-2">CSS</h4>
          <pre class="bg-gray-800 p-3 rounded overflow-x-auto whitespace-pre-wrap">${css}</pre>
        </div>
      `)
            .open();
    };

    const handleSaveBackend = async () => {
        // Collect current state
        const name = currentProject?.name || prompt('Enter project name:', 'My Project');
        if (!name) return;

        // Extract raw JSON data using GrapesJS API to store full state
        const components = editor.getComponents().map((c: any) => c.toJSON());
        const style = editor.getStyle();
        // Asset Manager needs to be handled carefully, for now simplistic approach
        const assets = editor.AssetManager.getAll().map((a: any) => ({ src: a.get('src'), type: a.get('type') }));

        const projectData: ProjectData = {
            name,
            content: components,
            styles: JSON.stringify(style), // Storing styles as JSON string for now
            assets: assets
        };

        try {
            let saved;
            if (currentProject?._id) {
                saved = await ProjectService.updateProject(currentProject._id, projectData);
            } else {
                saved = await ProjectService.saveProject(projectData);
            }
            setCurrentProject(saved);
            alert('Project saved to backend!');
        } catch (error) {
            console.error(error);
            alert('Failed to save project to backend.');
        }
    };

    const handleLoadBackend = (project: ProjectData) => {
        try {
            // Clear current
            editor.DomComponents.clear();
            editor.CssComposer.clear();

            // Load components
            editor.setComponents(project.content);

            // Load styles
            if (project.styles) {
                // Determine if styles are CSS string or JSON
                try {
                    const parsed = JSON.parse(project.styles);
                    editor.setStyle(parsed);
                } catch {
                    editor.setStyle(project.styles);
                }
            }

            // Load assets
            if (project.assets) {
                editor.AssetManager.add(project.assets);
            }

            setCurrentProject(project);
            setIsLoadModalOpen(false);
            alert(`Project "${project.name}" loaded!`);
        } catch (error) {
            console.error(error);
            alert('Failed to load project into editor.');
        }
    };

    const handleExportReact = async () => {
        if (!editor) return;
        const schema = exportProjectSchema(editor, currentProject?.name || 'My Project', variables, flows);
        try {
            const blob = await generateProjectKey(schema);
            saveAs(blob, `${schema.name}-react.zip`);
        } catch (error) {
            console.error('Failed to generate code:', error);
            alert('Failed to generate code. Check console for details.');
        }
    };

    return (
        <header className="flex items-center justify-between h-[50px] px-4 bg-gradient-to-r from-[#0a0a1a] to-[#1a1a2e] border-b border-[#2a2a4a] relative z-50">
            {/* Logo */}
            <div className="flex items-center gap-2 font-semibold text-lg text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-pink-500">
                <svg viewBox="0 0 100 100" className="w-7 h-7">
                    <path d="M40 5l-12.9 7.4 -12.9 7.4c-1.4 0.8-2.7 2.3-3.7 3.9 -0.9 1.6-1.5 3.5-1.5 5.1v14.9 14.9c0 1.7 0.6 3.5 1.5 5.1 0.9 1.6 2.2 3.1 3.7 3.9l12.9 7.4 12.9 7.4c1.4 0.8 3.3 1.2 5.2 1.2 1.9 0 3.8-0.4 5.2-1.2l12.9-7.4 12.9-7.4c1.4-0.8 2.7-2.2 3.7-3.9 0.9-1.6 1.5-3.5 1.5-5.1v-14.9 -12.7c0-4.6-3.8-6-6.8-4.2l-28 16.2" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" className="stroke-indigo-500" />
                </svg>
                <span>GrapesJS React</span>
                {currentProject && <span className="text-xs text-gray-400 ml-2">({currentProject.name})</span>}
            </div>

            {/* Device Switcher */}
            <div className="flex gap-1 bg-[#0a0a1a] p-1 rounded-lg border border-[#2a2a4a]">
                <DeviceBtn
                    icon={<Monitor size={18} />}
                    active={activeDevice === 'Desktop'}
                    onClick={() => handleDeviceChange('Desktop')}
                />
                <DeviceBtn
                    icon={<Tablet size={18} />}
                    active={activeDevice === 'Tablet'}
                    onClick={() => handleDeviceChange('Tablet')}
                />
                <DeviceBtn
                    icon={<Smartphone size={18} />}
                    active={activeDevice === 'Mobile portrait'}
                    onClick={() => handleDeviceChange('Mobile portrait')}
                />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
                <ActionBtn icon={<Undo size={16} />} onClick={() => editor.UndoManager.undo()} />
                <ActionBtn icon={<Redo size={16} />} onClick={() => editor.UndoManager.redo()} />
                <ActionBtn icon={<Trash2 size={16} />} onClick={handleClear} />
                <ActionBtn icon={<Code size={16} />} onClick={handleViewCode} />
                <ActionBtn icon={<Eye size={16} />} onClick={() => editor.runCommand('preview')} />
                <ActionBtn icon={<Maximize size={16} />} onClick={() => document.documentElement.requestFullscreen()} />

                <div className="w-px h-6 bg-[#2a2a4a] mx-1" /> {/* Divider */}

                <ActionBtn icon={<Save size={16} />} onClick={handleSaveBackend} title="Save to Cloud" />
                <ActionBtn icon={<FolderOpen size={16} />} onClick={() => setIsLoadModalOpen(true)} title="Load from Cloud" />

                <button
                    onClick={handleExportReact}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-md text-sm font-medium hover:-translate-y-px hover:shadow-lg hover:shadow-indigo-500/40 transition-all border-none"
                >
                    <Download size={16} />
                    <span>Export App</span>
                </button>
            </div>

            <ProjectListModal
                isOpen={isLoadModalOpen}
                onClose={() => setIsLoadModalOpen(false)}
                onLoadProject={handleLoadBackend}
            />
        </header>
    );
};

// Sub-components
const DeviceBtn = ({ icon, active, onClick }: { icon: React.ReactNode, active: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`w-9 h-8 flex items-center justify-center rounded transition-colors ${active ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
    >
        {icon}
    </button>
);

const ActionBtn = ({ icon, onClick, title }: { icon: React.ReactNode, onClick: () => void, title?: string }) => (
    <button
        onClick={onClick}
        title={title}
        className="px-3 py-2 text-slate-200 border border-[#2a2a4a] rounded hover:bg-indigo-500/10 hover:border-indigo-500 transition-colors bg-transparent"
    >
        {icon}
    </button>
);
