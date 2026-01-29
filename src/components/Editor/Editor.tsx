import React, { useState, useEffect } from 'react';
import { useGrapes } from '../../hooks/useGrapes';
import { Toolbar } from '../Toolbar';
import { Box, Paintbrush, Cog, Layers, EyeOff } from 'lucide-react';

export const Editor = () => {
    const { editor, editorRef } = useGrapes();
    const [activeTab, setActiveTab] = useState<'styles' | 'traits' | 'layers'>('styles');
    const [previewMode, setPreviewMode] = useState(false);

    // Handle Tab Switching
    const handleTabClick = (tab: 'styles' | 'traits' | 'layers') => {
        setActiveTab(tab);
    };

    // Listen for Preview Mode
    useEffect(() => {
        if (!editor) return;

        const onPreviewStart = () => setPreviewMode(true);
        const onPreviewStop = () => setPreviewMode(false);

        editor.on('run:preview', onPreviewStart);
        editor.on('stop:preview', onPreviewStop);

        return () => {
            editor.off('run:preview', onPreviewStart);
            editor.off('stop:preview', onPreviewStop);
        };
    }, [editor]);

    return (
        <div className="h-screen w-full flex flex-col bg-[#0f0f23] text-slate-200 overflow-hidden relative">
            {/* Loading Overlay */}
            {!editor && (
                <div className="fixed inset-0 bg-[#0f0f23] z-[9999] flex flex-col items-center justify-center">
                    <div className="w-12 h-12 border-4 border-[#2a2a4a] border-t-indigo-500 rounded-full animate-spin"></div>
                    <p className="mt-4 text-slate-400 text-sm">Loading Editor...</p>
                </div>
            )}

            {!previewMode && <Toolbar editor={editor} />}

            <div className="flex-1 flex overflow-hidden">

                {/* Left Sidebar - Blocks */}
                {!previewMode && (
                    <aside className="w-[280px] bg-[#1a1a2e] border-r border-[#2a2a4a] flex flex-col transition-all duration-300">
                        <div className="p-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-[#2a2a4a] bg-[#0a0a1a] flex items-center gap-2 sticky top-0 z-10">
                            <Box size={14} /> Components & Blocks
                        </div>
                        <div id="blocks-container" className="flex-1 overflow-y-auto p-3"></div>
                    </aside>
                )}

                {/* Canvas */}
                <main 
                    className={`flex-1 relative bg-[#0a0a1a] transition-all duration-300 ${previewMode ? 'z-[100]' : ''}`}
                    style={!previewMode ? { backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(99, 102, 241, 0.1) 1px, transparent 0)', backgroundSize: '20px 20px' } : {}}
                >
                    <div ref={editorRef} id="gjs" className="h-full border-none"></div>

                    {/* Exit Preview Button */}
                    {previewMode && (
                        <button
                            onClick={() => editor?.stopCommand('preview')}
                            className="absolute bottom-6 right-6 flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg hover:shadow-indigo-500/40 transition-all z-[9999] font-medium animate-in fade-in slide-in-from-bottom-4"
                        >
                            <EyeOff size={18} />
                            <span>Exit Preview</span>
                        </button>
                    )}
                </main>

                {/* Right Sidebar - Styles/Traits/Layers */}
                {!previewMode && (
                    <aside className="w-[300px] bg-[#1a1a2e] border-l border-[#2a2a4a] flex flex-col transition-all duration-300">
                        <div className="flex border-b border-[#2a2a4a] bg-[#0a0a1a]">
                            <TabBtn
                                active={activeTab === 'styles'}
                                icon={<Paintbrush size={14} />}
                                label="Styles"
                                onClick={() => handleTabClick('styles')}
                            />
                            <TabBtn
                                active={activeTab === 'traits'}
                                icon={<Cog size={14} />}
                                label="Settings"
                                onClick={() => handleTabClick('traits')}
                            />
                            <TabBtn
                                active={activeTab === 'layers'}
                                icon={<Layers size={14} />}
                                label="Layers"
                                onClick={() => handleTabClick('layers')}
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            <div id="selectors-container" className={activeTab === 'styles' ? 'p-3' : 'hidden'}></div>
                            <div id="styles-container" className={activeTab === 'styles' ? 'p-3' : 'hidden'}></div>
                            <div id="traits-container" className={activeTab === 'traits' ? 'p-3' : 'hidden'}></div>
                            <div id="layers-container" className={activeTab === 'layers' ? 'p-3' : 'hidden'}></div>
                        </div>
                    </aside>
                )}

            </div>
        </div>
    );
};

const TabBtn = ({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) => (
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
