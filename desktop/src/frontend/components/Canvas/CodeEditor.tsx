import React, { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { getPage, getPageContent, getFileContent } from "../../stores/projectStore";

const CodeEditor: React.FC = () => {
    const { selectedPageId, selectedFilePath, project } = useProjectStore();
    const [code, setCode] = useState<string>("");
    const [error, setError] = useState<string | null>(null);

    const selectedPage = project && selectedPageId ? getPage(selectedPageId) : null;

    useEffect(() => {
        const fetchContent = async () => {
            if (selectedFilePath) {
                try {
                    setError(null);
                    const content = await getFileContent(selectedFilePath);
                    setCode(content);
                } catch (err) {
                    console.error("Failed to fetch file content:", err);
                    setError("read_error");
                }
                return;
            }

            if (!selectedPage) {
                setCode("");
                setError(null);
                return;
            }

            try {
                setError(null);
                const content = await getPageContent(selectedPage.id);
                setCode(content);
            } catch (err) {
                console.warn("Page content not yet available:", err);
                setCode("");
                setError("not_synced");
            }
        };
        fetchContent();
    }, [selectedPageId, selectedPage, selectedFilePath]);

    const handleEditorChange = (value: string | undefined) => {
        if (value) {
            setCode(value);
            // In a real implementation, this would trigger a 'dry-parse' and update the visual preview
            // and also sync to the physical disk.
        }
    };

    if (!selectedPage && !selectedFilePath) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-[var(--ide-text-muted)] bg-[var(--ide-bg)] animate-fade-in p-12">
                <div className="w-16 h-16 rounded-2xl bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] flex items-center justify-center mb-4 text-white/20">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                </div>
                <h3 className="text-white font-bold mb-1">No File Selected</h3>
                <p className="text-xs text-[var(--ide-text-muted)]">Select a file from the explorer to view source code</p>
            </div>
        );
    }

    if (error === "not_synced" || error === "read_error") {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-[var(--ide-bg)] p-8 animate-fade-in">
                <div className="w-20 h-20 rounded-3xl bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] flex items-center justify-center mb-6 shadow-2xl overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <svg className="w-10 h-10 text-[var(--ide-text-muted)] group-hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h3 className="text-xl font-black text-white mb-2 tracking-tight">
                    {error === "read_error" ? "Read Error" : "Not Synced"}
                </h3>
                <p className="text-sm text-[var(--ide-text-muted)] text-center max-w-sm leading-relaxed">
                    {error === "read_error"
                        ? "The physical file couldn't be located or accessed on disk."
                        : "Visual changes haven't been exported to disk yet. Add some blocks to trigger a sync."}
                </p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-[var(--ide-bg)]">
            {/* Editor Header */}
            <div className="h-10 bg-[var(--ide-bg-sidebar)] border-b border-[var(--ide-border)] px-4 flex items-center justify-between shrink-0 select-none">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1.5 shrink-0 mr-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500/50" />
                    </div>
                    <span className="text-[10px] font-black text-white tracking-widest uppercase">
                        {selectedFilePath ? selectedFilePath.split('/').pop() : `${selectedPage?.name}.tsx`}
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-[10px] text-[var(--ide-text-muted)] font-medium tracking-tight bg-[var(--ide-panel)] px-2 py-0.5 rounded border border-[var(--ide-border)]">
                        LIVE SYNC ACTIVE
                    </span>
                </div>
            </div>

            {/* Monaco Editor */}
            <div className="flex-1 overflow-hidden">
                <Editor
                    height="100%"
                    defaultLanguage={selectedFilePath?.endsWith('.rs') ? 'rust' : selectedFilePath?.endsWith('.json') ? 'json' : 'typescript'}
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
