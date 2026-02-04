import React, { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { getPage } from "../../stores/projectStore";

const CodeEditor: React.FC = () => {
    const { selectedPageId, project } = useProjectStore();
    const [code, setCode] = useState<string>("");

    const selectedPage = project && selectedPageId ? getPage(selectedPageId) : null;

    useEffect(() => {
        if (selectedPage) {
            // In a real implementation, we would fetch the live content from the physical file
            // via a Tauri command. For now, we'll generate a placeholder from the schema.
            const placeholder = `// @grapes-page id="${selectedPage.id}"
import React from 'react';

export default function ${selectedPage.name.replace(/\s+/g, '')}() {
  return (
    <div className="p-8 bg-white min-h-screen">
      <h1 className="text-4xl font-black text-slate-900 mb-4">${selectedPage.name}</h1>
      <p className="text-slate-600 leading-relaxed">
        This is a live-synced code view of your page.
        Editing here will update your visual blocks.
      </p>
      
      {/* Visual Blocks Start */}
      <div className="mt-8 p-6 bg-slate-50 border border-slate-200 rounded-2xl">
        <button className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold">
          Click Me
        </button>
      </div>
      {/* Visual Blocks End */}
    </div>
  );
}`;
            setCode(placeholder);
        }
    }, [selectedPageId, selectedPage?.name]);

    const handleEditorChange = (value: string | undefined) => {
        if (value) {
            setCode(value);
            // In a real implementation, this would trigger a 'dry-parse' and update the visual preview
            // and also sync to the physical disk.
        }
    };

    if (!selectedPage) {
        return (
            <div className="h-full flex items-center justify-center text-ide-text-muted bg-[#0d0d14]">
                <p>Select a page to view its code</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-[#0d0d14]">
            {/* Editor Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-black/20">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/30" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/30" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/30" />
                    </div>
                    <span className="text-[10px] font-mono text-ide-text-muted ml-2 tracking-widest uppercase">
                        {selectedPage.name}.tsx
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-[10px] text-indigo-400/60 font-medium tracking-tight bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10">
                        LIVE SYNC ACTIVE
                    </span>
                </div>
            </div>

            {/* Monaco Editor */}
            <div className="flex-1 overflow-hidden">
                <Editor
                    height="100%"
                    defaultLanguage="typescript"
                    theme="vs-dark"
                    value={code}
                    onChange={handleEditorChange}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        padding: { top: 20 },
                        cursorSmoothCaretAnimation: "on",
                        smoothScrolling: true,
                        lineNumbersMinChars: 3,
                        glyphMargin: false,
                        folding: true,
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        wordWrap: "on",
                    }}
                />
            </div>
        </div>
    );
};

export default CodeEditor;
