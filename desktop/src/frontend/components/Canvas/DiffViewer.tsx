/**
 * DiffViewer — Read-only diff viewer that shows file changes
 * with green (added) and red (deleted) line highlighting.
 * Opened from the Source Control panel when clicking a file in a commit.
 */

import React from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { closeDiffView } from "../../stores/projectStore";

const DiffViewer: React.FC = () => {
    const { diffView } = useProjectStore();

    if (!diffView) return null;

    const basename = diffView.filename.split("/").pop() || diffView.filename;
    const dir = diffView.filename.includes("/")
        ? diffView.filename.substring(0, diffView.filename.lastIndexOf("/"))
        : "";

    return (
        <div className="h-full flex flex-col bg-[var(--ide-bg)]">
            {/* Header bar */}
            <div className="h-9 bg-[var(--ide-chrome)] border-b border-[var(--ide-border)] px-3 flex items-center justify-between shrink-0 select-none">
                {/* Left: file info */}
                <div className="flex items-center gap-2 min-w-0">
                    {/* Close button */}
                    <button
                        onClick={closeDiffView}
                        className="w-5 h-5 rounded hover:bg-[var(--ide-text)]/10 flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors flex-shrink-0"
                        title="Close diff view"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    {/* Diff icon */}
                    <svg className="w-4 h-4 text-[var(--ide-primary)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>

                    {/* File name + path */}
                    <span className="text-xs text-[var(--ide-text)] font-medium truncate">{basename}</span>
                    {dir && (
                        <span className="text-[10px] text-[var(--ide-text-muted)] truncate">{dir}</span>
                    )}

                    {/* Commit info */}
                    <span className="text-[10px] text-[var(--ide-text-muted)] ml-2 flex-shrink-0">
                        <span className="font-mono text-[var(--ide-primary)]">{diffView.commitId.slice(0, 7)}</span>
                        {" — "}
                        <span className="italic">{diffView.commitMessage}</span>
                    </span>
                </div>

                {/* Right: legend */}
                <div className="flex items-center gap-3 text-[10px] flex-shrink-0 ml-4">
                    <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-sm bg-green-500/20 border border-green-500/40" />
                        <span className="text-green-400">Added</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-sm bg-red-500/20 border border-red-500/40" />
                        <span className="text-red-400">Deleted</span>
                    </span>
                </div>
            </div>

            {/* Diff content */}
            <div className="flex-1 overflow-auto font-mono text-[13px] leading-[1.65]">
                {diffView.lines.map((line, i) => {
                    let bgClass = "";
                    let textClass = "text-[var(--ide-text-secondary)]";
                    let gutterSymbol = " ";
                    let gutterBg = "";
                    let lineNumColor = "text-[var(--ide-text-muted)]";

                    if (line.type === "add") {
                        bgClass = "bg-green-500/[0.08]";
                        textClass = "text-green-300";
                        gutterSymbol = "+";
                        gutterBg = "bg-green-500/[0.15]";
                        lineNumColor = "text-green-500/60";
                    } else if (line.type === "del") {
                        bgClass = "bg-red-500/[0.08]";
                        textClass = "text-red-300";
                        gutterSymbol = "−";
                        gutterBg = "bg-red-500/[0.15]";
                        lineNumColor = "text-red-500/60";
                    } else if (line.type === "hunk") {
                        bgClass = "bg-[var(--ide-primary)]/[0.06]";
                        textClass = "text-[var(--ide-primary)]";
                        gutterSymbol = "@@";
                        gutterBg = "bg-[var(--ide-primary)]/[0.1]";
                        lineNumColor = "text-[var(--ide-primary)]/50";
                    }

                    return (
                        <div key={i} className={`flex ${bgClass} hover:brightness-110 transition-all`}>
                            {/* Line number gutter */}
                            <div className={`w-12 flex-shrink-0 text-right pr-2 select-none ${lineNumColor} text-[11px] leading-[1.65] border-r border-[var(--ide-border)]/30 ${gutterBg}`}>
                                {line.type === "hunk" ? "" : i + 1}
                            </div>
                            {/* +/- indicator */}
                            <div className={`w-6 flex-shrink-0 text-center select-none ${textClass} font-bold ${gutterBg}`}>
                                {gutterSymbol}
                            </div>
                            {/* Code content */}
                            <div className={`flex-1 px-3 whitespace-pre ${textClass}`}>
                                {line.text || " "}
                            </div>
                        </div>
                    );
                })}

                {/* Bottom padding */}
                <div className="h-12" />
            </div>

            {/* Status bar */}
            <div className="h-6 bg-[var(--ide-statusbar)] px-3 flex items-center justify-between text-[11px] text-white select-none shrink-0">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                        <svg className="w-3 h-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="font-medium">Diff View</span>
                    </span>
                    <span className="opacity-70">{basename}</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-green-300">
                        +{diffView.lines.filter(l => l.type === "add").length}
                    </span>
                    <span className="text-red-300">
                        −{diffView.lines.filter(l => l.type === "del").length}
                    </span>
                    <span className="opacity-60">
                        {diffView.lines.length} lines
                    </span>
                </div>
            </div>
        </div>
    );
};

export default DiffViewer;
