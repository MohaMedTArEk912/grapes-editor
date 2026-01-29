import React from 'react';
import type { Editor } from 'grapesjs';
import {
    Undo, Redo, Trash2, Code, Eye,
    Maximize, Download, Monitor, Tablet, Smartphone
} from 'lucide-react';

interface ToolbarProps {
    editor: Editor | null;
}

export const Toolbar: React.FC<ToolbarProps> = ({ editor }) => {
    const [activeDevice, setActiveDevice] = React.useState('Desktop');

    if (!editor) return null;

    const handleDeviceChange = (device: string) => {
        setActiveDevice(device);
        editor.setDevice(device);
    };

    const handleClear = () => {
        if (confirm('Are you sure you want to clear the canvas?')) {
            editor.DomComponents.clear();
            editor.CssComposer.clear();
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

    const handleExport = () => {
        const html = editor.getHtml();
        const css = editor.getCss();
        const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${css}</style>
</head>
<body>${html}</body>
</html>`;

        const blob = new Blob([fullHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'exported-page.html';
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <header className="flex items-center justify-between h-[50px] px-4 bg-gradient-to-r from-[#0a0a1a] to-[#1a1a2e] border-b border-[#2a2a4a] relative z-50">
            {/* Logo */}
            <div className="flex items-center gap-2 font-semibold text-lg text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-pink-500">
                <svg viewBox="0 0 100 100" className="w-7 h-7">
                    <path d="M40 5l-12.9 7.4 -12.9 7.4c-1.4 0.8-2.7 2.3-3.7 3.9 -0.9 1.6-1.5 3.5-1.5 5.1v14.9 14.9c0 1.7 0.6 3.5 1.5 5.1 0.9 1.6 2.2 3.1 3.7 3.9l12.9 7.4 12.9 7.4c1.4 0.8 3.3 1.2 5.2 1.2 1.9 0 3.8-0.4 5.2-1.2l12.9-7.4 12.9-7.4c1.4-0.8 2.7-2.2 3.7-3.9 0.9-1.6 1.5-3.5 1.5-5.1v-14.9 -12.7c0-4.6-3.8-6-6.8-4.2l-28 16.2" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" className="stroke-indigo-500" />
                </svg>
                <span>GrapesJS React</span>
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

                <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-md text-sm font-medium hover:-translate-y-px hover:shadow-lg hover:shadow-indigo-500/40 transition-all border-none"
                >
                    <Download size={16} />
                    <span>Export</span>
                </button>
            </div>
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

const ActionBtn = ({ icon, onClick }: { icon: React.ReactNode, onClick: () => void }) => (
    <button
        onClick={onClick}
        className="px-3 py-2 text-slate-200 border border-[#2a2a4a] rounded hover:bg-indigo-500/10 hover:border-indigo-500 transition-colors bg-transparent"
    >
        {icon}
    </button>
);
