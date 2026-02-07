import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Editor, { type Monaco } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { useProjectStore } from "../../hooks/useProjectStore";
import { useEditorSettings } from "../../hooks/useEditorSettings";
import { useTheme } from "../../context/ThemeContext";
import { getPage, getPageContent, getFileContent, saveFileContent } from "../../stores/projectStore";
import * as EditorSettingsStore from "../../stores/editorSettingsStore";

class MonacoErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; message: string | null }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, message: null };
    }

    static getDerivedStateFromError(error: unknown) {
        return { hasError: true, message: String(error) };
    }

    componentDidCatch(error: unknown) {
        console.error("Monaco editor crashed:", error);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="h-full w-full flex items-center justify-center bg-[var(--ide-bg)] text-[var(--ide-text-muted)] p-8">
                    <div className="max-w-md text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 className="text-[var(--ide-text)] font-semibold mb-2">Editor Failed To Load</h3>
                        <p className="text-sm mb-3">The Monaco editor crashed while opening this file.</p>
                        {this.state.message && (
                            <p className="text-xs opacity-80 break-words bg-[var(--ide-bg-panel)] p-3 rounded border border-[var(--ide-border)]">
                                {this.state.message}
                            </p>
                        )}
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-4 px-4 py-2 text-sm bg-[var(--ide-primary)] hover:bg-[var(--ide-primary-hover)] text-white rounded transition-colors"
                        >
                            Reload Editor
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

function toMonacoModelPath(rawPath: string | null): string {
    if (!rawPath) return "inmemory://model/untitled.tsx";

    const normalized = rawPath.replace(/\\/g, "/");
    const fileName = normalized.split("/").filter(Boolean).pop() || "untitled.tsx";
    const key = encodeURIComponent(normalized);
    const safeName = encodeURIComponent(fileName);

    return `inmemory://model/${key}/${safeName}`;
}

function pascalCase(input: string): string {
    return input
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("");
}

function getPageSourcePath(pageName: string): string {
    return `client/page/${pascalCase(pageName)}.tsx`;
}

function formatSavedTime(date: Date): string {
    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

const EXT_TO_LANGUAGE: Record<string, string> = {
    // Web
    ".html": "html", ".htm": "html",
    ".css": "css", ".scss": "scss", ".less": "less",
    ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript", ".cjs": "javascript",
    ".ts": "typescript", ".tsx": "typescript", ".mts": "typescript", ".cts": "typescript",
    ".json": "json", ".jsonc": "json",
    ".xml": "xml", ".xsl": "xml", ".xsd": "xml", ".svg": "xml",
    ".yaml": "yaml", ".yml": "yaml",
    ".md": "markdown", ".mdx": "markdown",
    ".graphql": "graphql", ".gql": "graphql",
    ".pug": "pug",
    ".hbs": "handlebars", ".handlebars": "handlebars",

    // Systems / compiled
    ".rs": "rust",
    ".go": "go",
    ".c": "cpp", ".h": "cpp", ".cpp": "cpp", ".cxx": "cpp", ".cc": "cpp", ".hpp": "cpp",
    ".cs": "csharp",
    ".java": "java",
    ".kt": "kotlin", ".kts": "kotlin",
    ".swift": "swift",
    ".m": "objective-c", ".mm": "objective-c",
    ".dart": "dart",
    ".scala": "scala",
    ".r": "r", ".R": "r",

    // Scripting
    ".py": "python", ".pyw": "python",
    ".rb": "ruby",
    ".php": "php",
    ".pl": "perl", ".pm": "perl",
    ".lua": "lua",
    ".coffee": "coffeescript",
    ".clj": "clojure", ".cljs": "clojure", ".cljc": "clojure",
    ".fs": "fsharp", ".fsx": "fsharp",
    ".ex": "elixir", ".exs": "elixir",
    ".jl": "julia",
    ".vb": "vb",

    // Shell / config
    ".sh": "shell", ".bash": "shell", ".zsh": "shell",
    ".bat": "bat", ".cmd": "bat",
    ".ps1": "powershell", ".psm1": "powershell",
    ".ini": "ini", ".cfg": "ini", ".conf": "ini", ".properties": "ini",
    ".toml": "ini",
    ".env": "ini",

    // Data / query
    ".sql": "sql",
    ".mysql": "mysql",
    ".pgsql": "pgsql",

    // DevOps / infra
    ".dockerfile": "dockerfile",
    ".tf": "hcl", ".hcl": "hcl",
    ".proto": "protobuf",

    // Misc
    ".pas": "pascal", ".pp": "pascal",
    ".sol": "sol",
    ".asm": "mips", ".s": "mips",
};

function getEditorLanguage(path: string | null): string {
    if (!path) return "typescript";

    // Handle dot-files like "Dockerfile", ".gitignore"
    const filename = path.split(/[/\\]/).pop()?.toLowerCase() ?? "";
    if (filename === "dockerfile" || filename.startsWith("dockerfile.")) return "dockerfile";
    if (filename === "makefile" || filename === "gnumakefile") return "shell";

    // Match by extension (try longest first for compound extensions like .d.ts)
    const lower = path.toLowerCase();
    const dotIdx = lower.lastIndexOf(".");
    if (dotIdx !== -1) {
        const ext = lower.slice(dotIdx);
        const lang = EXT_TO_LANGUAGE[ext];
        if (lang) return lang;
    }

    return "plaintext";
}

const CodeEditor: React.FC = () => {
    const { selectedPageId, selectedFilePath, project } = useProjectStore();
    const settings = useEditorSettings();
    const { theme: appTheme } = useTheme();
    const [code, setCode] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);

    const selectedPage = project && selectedPageId ? getPage(selectedPageId) : null;
    const activePath = useMemo(
        () => selectedFilePath ?? (selectedPage ? getPageSourcePath(selectedPage.name) : null),
        [selectedFilePath, selectedPage]
    );
    const editorLanguage = getEditorLanguage(activePath);
    const editorPath = toMonacoModelPath(activePath);
    const monacoTheme = appTheme === "light" ? "vs-light" : "vs-dark";

    // Calculate effective font size based on zoom level
    const effectiveFontSize = useMemo(() => {
        return Math.round(settings.fontSize * (settings.zoomLevel / 100));
    }, [settings.fontSize, settings.zoomLevel]);

    const handleBeforeMount = (monaco: Monaco) => {
        try {
            monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                target: monaco.languages.typescript.ScriptTarget.ES2020,
                module: monaco.languages.typescript.ModuleKind.ESNext,
                moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
                jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
                allowNonTsExtensions: true,
                allowSyntheticDefaultImports: true,
                esModuleInterop: true,
            });

            // Disable semantic validation for better performance
            monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                noSemanticValidation: true,  // Disabled for performance
                noSyntaxValidation: false,
            });
        } catch (err) {
            console.warn("Failed to configure Monaco TypeScript compiler options:", err);
        }
    };

    useEffect(() => {
        const fetchContent = async () => {
            if (selectedFilePath) {
                try {
                    setError(null);
                    setSaveError(null);
                    const content = await getFileContent(selectedFilePath);
                    setCode(content);
                    setIsDirty(false);
                } catch (err) {
                    console.error("Failed to fetch file content:", err);
                    setError("read_error");
                }
                return;
            }

            if (!selectedPage) {
                setCode("");
                setError(null);
                setSaveError(null);
                setIsDirty(false);
                return;
            }

            try {
                setError(null);
                setSaveError(null);
                const content = await getPageContent(selectedPage.id);
                setCode(content);
                setIsDirty(false);
            } catch (err) {
                console.warn("Page content not yet available:", err);
                setCode("");
                setError("not_synced");
            }
        };
        fetchContent();
    }, [selectedPageId, selectedPage, selectedFilePath]);

    useEffect(() => {
        if (!activePath || !isDirty || !!error || !settings.autoSave) return;

        const timer = window.setTimeout(async () => {
            try {
                setIsSaving(true);
                setSaveError(null);
                await saveFileContent(activePath, code);
                setIsDirty(false);
                setLastSavedAt(new Date());
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                setSaveError(msg);
                console.error("Autosave failed:", err);
            } finally {
                setIsSaving(false);
            }
        }, settings.autoSaveDelay);

        return () => window.clearTimeout(timer);
    }, [activePath, code, error, isDirty, settings.autoSave, settings.autoSaveDelay]);

    const handleEditorChange = (value: string | undefined) => {
        if (value === undefined) return;
        setCode(value);
        setIsDirty(true);
        setSaveError(null);
    };

    const handleEditorMount = (editor: MonacoEditor.IStandaloneCodeEditor) => {
        editorRef.current = editor;

        // Add keyboard shortcuts using numeric key codes
        // Ctrl/Cmd + = (zoom in)
        editor.addCommand(2048 | 81, () => {  // KeyMod.CtrlCmd | KeyCode.Equal
            EditorSettingsStore.zoomIn();
        });
        // Ctrl/Cmd + - (zoom out)
        editor.addCommand(2048 | 88, () => {  // KeyMod.CtrlCmd | KeyCode.Minus
            EditorSettingsStore.zoomOut();
        });
        // Ctrl/Cmd + 0 (reset zoom)
        editor.addCommand(2048 | 21, () => {  // KeyMod.CtrlCmd | KeyCode.Digit0
            EditorSettingsStore.resetZoom();
        });
    };

    const handleUndo = () => {
        editorRef.current?.trigger("grapes-editor", "undo", null);
    };

    const handleRedo = () => {
        editorRef.current?.trigger("grapes-editor", "redo", null);
    };

    const handleFormatDocument = useCallback(() => {
        editorRef.current?.getAction("editor.action.formatDocument")?.run();
    }, []);

    const statusText = saveError
        ? "AUTOSAVE FAILED"
        : isSaving
            ? "SAVING..."
            : isDirty
                ? "UNSAVED CHANGES"
                : lastSavedAt
                    ? `SAVED ${formatSavedTime(lastSavedAt)}`
                    : "LIVE SYNC ACTIVE";

    if (!selectedPage && !selectedFilePath) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-[var(--ide-text-muted)] bg-[var(--ide-bg)] animate-fade-in p-12">
                <div className="w-16 h-16 rounded-2xl bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] flex items-center justify-center mb-4 text-white/20">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                </div>
                <h3 className="text-[var(--ide-text)] font-bold mb-1">No File Selected</h3>
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
                <h3 className="text-xl font-black text-[var(--ide-text)] mb-2 tracking-tight">
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
            {/* Enhanced Editor Header */}
            <div className="h-11 bg-[var(--ide-bg-sidebar)] border-b border-[var(--ide-border)] px-4 flex items-center justify-between shrink-0 select-none">
                <div className="flex items-center gap-3">
                    <div className="flex gap-1.5 shrink-0">
                        <div className={`w-2.5 h-2.5 rounded-full ${isDirty ? "bg-yellow-500/70" : "bg-green-500/50"}`} />
                    </div>
                    <span className="text-[11px] font-bold text-[var(--ide-text)] tracking-wide">
                        {activePath?.split("/").pop() ?? "Untitled"}
                    </span>
                    <span className="text-[10px] text-[var(--ide-text-muted)] uppercase tracking-wider">
                        {editorLanguage}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    {/* Zoom Controls */}
                    <div className="flex items-center gap-1 bg-[var(--ide-bg-panel)] rounded border border-[var(--ide-border)] px-1">
                        <button
                            onClick={() => EditorSettingsStore.zoomOut()}
                            className="h-6 w-6 flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-text)]/10 rounded transition-colors"
                            title="Zoom Out (Ctrl/Cmd+-)"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
                            </svg>
                        </button>
                        <button
                            onClick={() => EditorSettingsStore.resetZoom()}
                            className="h-6 px-2 text-[10px] font-medium text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-text)]/10 rounded transition-colors min-w-[45px]"
                            title="Reset Zoom (Ctrl/Cmd+0)"
                        >
                            {settings.zoomLevel}%
                        </button>
                        <button
                            onClick={() => EditorSettingsStore.zoomIn()}
                            className="h-6 w-6 flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-text)]/10 rounded transition-colors"
                            title="Zoom In (Ctrl/Cmd++)"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                    </div>

                    {/* Editor Options */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => EditorSettingsStore.toggleMinimap()}
                            className={`h-7 px-2.5 text-[10px] font-medium rounded border transition-colors ${settings.minimap
                                ? "bg-[var(--ide-primary)] border-[var(--ide-primary)] text-white"
                                : "border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:border-[var(--ide-primary)]"
                                }`}
                            title="Toggle Minimap"
                        >
                            MAP
                        </button>
                        <button
                            onClick={() => EditorSettingsStore.toggleWordWrap()}
                            className={`h-7 px-2.5 text-[10px] font-medium rounded border transition-colors ${settings.wordWrap === "on"
                                ? "bg-[var(--ide-primary)] border-[var(--ide-primary)] text-white"
                                : "border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:border-[var(--ide-primary)]"
                                }`}
                            title="Toggle Word Wrap"
                        >
                            WRAP
                        </button>
                        <button
                            onClick={handleFormatDocument}
                            className="h-7 px-2.5 text-[10px] font-medium rounded border border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:border-[var(--ide-primary)] transition-colors"
                            title="Format Document (Shift+Alt+F)"
                        >
                            FORMAT
                        </button>
                    </div>

                    {/* Undo/Redo */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleUndo}
                            className="h-7 px-2.5 text-[10px] font-medium rounded border border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:border-[var(--ide-primary)] transition-colors"
                            title="Undo (Ctrl/Cmd+Z)"
                        >
                            UNDO
                        </button>
                        <button
                            onClick={handleRedo}
                            className="h-7 px-2.5 text-[10px] font-medium rounded border border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:border-[var(--ide-primary)] transition-colors"
                            title="Redo (Ctrl/Cmd+Y)"
                        >
                            REDO
                        </button>
                    </div>

                    {/* Save Status */}
                    <span className={`text-[10px] font-medium tracking-tight px-2.5 py-1 rounded border ${saveError
                        ? "text-red-300 bg-red-500/10 border-red-500/30"
                        : isDirty
                            ? "text-yellow-300 bg-yellow-500/10 border-yellow-500/30"
                            : "text-green-300 bg-green-500/10 border-green-500/30"
                        }`}>
                        {statusText}
                    </span>
                </div>
            </div>

            {/* Monaco Editor */}
            <div className="flex-1 overflow-hidden">
                <MonacoErrorBoundary>
                    <Editor
                        height="100%"
                        beforeMount={handleBeforeMount}
                        language={editorLanguage}
                        path={editorPath}
                        theme={monacoTheme}
                        value={code}
                        onChange={handleEditorChange}
                        onMount={handleEditorMount}
                        options={{
                            minimap: { enabled: settings.minimap },
                            fontSize: effectiveFontSize,
                            fontFamily: settings.fontFamily,
                            lineHeight: settings.lineHeight * effectiveFontSize,
                            tabSize: settings.tabSize,
                            insertSpaces: settings.insertSpaces,
                            wordWrap: settings.wordWrap,
                            padding: { top: 12, bottom: 12 },
                            cursorSmoothCaretAnimation: "off",  // Disabled for performance
                            smoothScrolling: false,  // Disabled for performance
                            lineNumbersMinChars: 3,
                            glyphMargin: false,
                            folding: settings.folding,
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            bracketPairColorization: { enabled: settings.bracketPairColorization },
                            stickyScroll: { enabled: settings.stickyScroll },
                            suggest: {
                                showInlineDetails: false,  // Reduced for performance
                                preview: false,  // Disabled for performance
                            },
                            quickSuggestions: {
                                other: false,  // Only show on trigger
                                comments: false,
                                strings: false,
                            },
                            parameterHints: { enabled: true },
                            formatOnPaste: false,  // Disabled for performance
                            formatOnType: false,  // Disabled for performance
                            renderWhitespace: "none",  // Disabled for performance
                            renderLineHighlight: "line",  // Reduced from "all"
                            occurrencesHighlight: "off",  // Disabled for performance
                        }}
                    />
                </MonacoErrorBoundary>
            </div>
        </div>
    );
};

export default CodeEditor;
