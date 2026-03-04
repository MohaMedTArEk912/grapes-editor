import React, { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import { useToast } from '../../context/ToastContext';
import { httpApi } from '../../hooks/useHttpApi';

interface IdeaWorkshopProps {
    projectName: string;
    projectId?: string;
    initialIdea?: string;
    fullScreen?: boolean;
    onRefined: (refinedIdea: string) => void;
    onCancel: () => void;
}

type Phase = 'input' | 'analyzing' | 'discussion' | 'refining' | 'complete';

const QUICK_PROMPTS = [
    'What is the biggest market risk here?',
    'Suggest an MVP scope for 4 weeks.',
    'What should we cut to ship faster?',
    'What metrics should we track in v1?',
    'Give a clearer pricing strategy.',
    'What technical stack is safest for launch?',
];

export default function IdeaWorkshop({
    projectName,
    projectId,
    initialIdea = '',
    fullScreen = false,
    onRefined,
    onCancel,
}: IdeaWorkshopProps) {
    const toast = useToast();
    const chatEndRef = useRef<HTMLDivElement>(null);

    const [phase, setPhase] = useState<Phase>('input');
    const [idea, setIdea] = useState(initialIdea);
    const [analysis, setAnalysis] = useState<any>(null);
    const [history, setHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatting, setIsChatting] = useState(false);
    const [refinedIdea, setRefinedIdea] = useState('');
    const [copied, setCopied] = useState(false);

    const draftStorageKey = useMemo(
        () => `akasha:idea-workshop:draft:${projectId || projectName}`,
        [projectId, projectName]
    );

    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [history, isChatting]);

    useEffect(() => {
        if (initialIdea.trim()) return;
        const saved = localStorage.getItem(draftStorageKey);
        if (saved && saved.trim()) {
            setIdea(saved);
        }
    }, [draftStorageKey, initialIdea]);

    useEffect(() => {
        if (!idea.trim()) {
            localStorage.removeItem(draftStorageKey);
            return;
        }
        localStorage.setItem(draftStorageKey, idea);
    }, [draftStorageKey, idea]);

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]';
        if (score >= 60) return 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]';
        return 'text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]';
    };

    const runAnalyze = async () => {
        if (!idea.trim()) {
            toast.showToast('Please describe your idea first.', 'warning');
            return;
        }

        setPhase('analyzing');
        try {
            const result = await httpApi.analyzeIdea(idea);
            setAnalysis(result);
            setHistory([
                {
                    role: 'assistant',
                    content:
                        "I analyzed your idea. Ask for changes, tradeoffs, scope cuts, pricing, GTM, or technical architecture.",
                },
            ]);
            setPhase('discussion');
        } catch (err: any) {
            toast.showToast('Failed to analyze idea', 'error');
            setPhase('input');
        }
    };

    const sendDiscussionMessage = async (userMsg: string) => {
        if (!userMsg.trim() || isChatting) return;

        setHistory((prev) => [...prev, { role: 'user', content: userMsg }]);
        setIsChatting(true);

        try {
            const contextMsg =
                'Project Idea:\n' +
                idea +
                '\n\nAnalysis JSON:\n' +
                JSON.stringify(analysis || {}, null, 2) +
                '\n\nUser request:\n' +
                userMsg;

            const res = await fetch('http://localhost:3001/api/ai/simple-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: contextMsg }),
            });

            const data = await res.json();
            if (res.ok) {
                setHistory((prev) => [...prev, { role: 'assistant', content: data.reply || '' }]);
            } else {
                toast.showToast(data.error || 'Chat failed', 'error');
            }
        } catch (err: any) {
            toast.showToast('Chat failed: ' + err.message, 'error');
        } finally {
            setIsChatting(false);
        }
    };

    const handleSendChat = async (e?: React.FormEvent) => {
        e?.preventDefault();
        const userMsg = chatInput.trim();
        if (!userMsg) return;
        setChatInput('');
        await sendDiscussionMessage(userMsg);
    };

    const handleQuickPrompt = async (prompt: string) => {
        await sendDiscussionMessage(prompt);
    };

    const handleRefine = async () => {
        setPhase('refining');
        try {
            const result = await httpApi.refineIdea(idea, history, projectId);
            setRefinedIdea(result.refinedIdea || '');
            setPhase('complete');
        } catch (err: any) {
            toast.showToast('Failed to refine idea', 'error');
            setPhase('discussion');
        }
    };

    const handleClearDiscussion = () => {
        setHistory([]);
        setChatInput('');
    };

    const handleUndoLast = () => {
        setHistory((prev) => prev.slice(0, -1));
    };

    const handleCopyMarkdown = async () => {
        if (!refinedIdea.trim()) return;
        try {
            await navigator.clipboard.writeText(refinedIdea);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            toast.showToast('Failed to copy markdown', 'error');
        }
    };

    const handleDownloadMarkdown = () => {
        if (!refinedIdea.trim()) return;
        const fileName = `${projectName || 'project'}-prd.md`
            .toLowerCase()
            .replace(/[^a-z0-9\-]+/g, '-')
            .replace(/-+/g, '-');
        const blob = new Blob([refinedIdea], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const renderChatPanel = () => (
        <div className="flex-1 min-h-0 flex flex-col bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded-2xl overflow-hidden shadow-inner">
            <div className="bg-black/20 px-4 py-2 border-b border-[var(--ide-border)] flex items-center justify-between">
                <span className="text-[10px] font-black text-[var(--ide-text-muted)] uppercase tracking-widest">Discussion</span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleUndoLast}
                        disabled={history.length === 0}
                        className="h-7 px-2 rounded-lg text-[10px] font-bold bg-white/5 border border-white/10 text-white/60 hover:text-white disabled:opacity-40 transition-all"
                    >
                        Undo
                    </button>
                    <button
                        onClick={handleClearDiscussion}
                        disabled={history.length === 0 && !chatInput.trim()}
                        className="h-7 px-2 rounded-lg text-[10px] font-bold bg-white/5 border border-white/10 text-white/60 hover:text-white disabled:opacity-40 transition-all"
                    >
                        Clear
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {history.length === 0 && !isChatting && (
                    <div className="h-full flex items-center justify-center text-center text-white/40 text-sm">
                        Start by asking for scope, architecture, pricing, go-to-market, or risk reduction.
                    </div>
                )}

                {history.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                            className={`max-w-[92%] rounded-2xl px-4 py-3 ${
                                msg.role === 'user'
                                    ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20 rounded-tr-sm'
                                    : 'bg-[var(--ide-bg-panel)] border border-[var(--ide-border)] text-gray-300 rounded-tl-sm shadow-sm'
                            } ${fullScreen ? 'text-base leading-relaxed' : 'text-sm'}`}
                        >
                            <div
                                dangerouslySetInnerHTML={{ __html: marked.parse(msg.content, { async: false }) as string }}
                                className="prose prose-invert prose-sm max-w-none"
                            />
                        </div>
                    </div>
                ))}

                {isChatting && (
                    <div className="flex justify-start">
                        <div className="bg-[var(--ide-bg-panel)] border border-[var(--ide-border)] rounded-2xl rounded-tl-sm px-4 py-3 text-sm flex gap-1 items-center">
                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div>
                        </div>
                    </div>
                )}

                <div ref={chatEndRef} />
            </div>

            <div className="px-3 py-2 border-t border-[var(--ide-border)] bg-black/10 flex flex-wrap gap-2">
                {QUICK_PROMPTS.slice(0, fullScreen ? 6 : 3).map((prompt) => (
                    <button
                        key={prompt}
                        onClick={() => handleQuickPrompt(prompt)}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20 transition-all"
                    >
                        {prompt}
                    </button>
                ))}
            </div>

            <form onSubmit={handleSendChat} className="p-3 bg-black/20 border-t border-[var(--ide-border)] flex gap-3">
                <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask AI to improve scope, product strategy, architecture, or go-to-market..."
                    className={`flex-1 bg-transparent text-white placeholder:text-white/30 focus:outline-none px-2 ${
                        fullScreen ? 'text-base py-1.5' : 'text-sm'
                    }`}
                />
                <button
                    type="submit"
                    disabled={!chatInput.trim() || isChatting}
                    className={`bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-400 disabled:opacity-50 transition-all ${
                        fullScreen ? 'h-10 px-5 text-sm' : 'h-8 px-4 text-xs'
                    }`}
                >
                    Send
                </button>
            </form>
        </div>
    );

    return (
        <div
            className={`w-full flex flex-col bg-[var(--ide-bg-panel)] border border-[var(--ide-border-strong)] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden relative ${
                fullScreen ? 'h-full rounded-2xl' : 'max-w-4xl mx-auto h-[80vh] rounded-3xl animate-slide-up'
            }`}
        >
            <div className="flex-shrink-0 flex items-center justify-between p-5 border-b border-[var(--ide-border)] bg-gradient-to-b from-white/[0.02] to-transparent">
                <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-lg md:text-xl font-black text-[var(--ide-text)]">AI Idea Workshop</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-[var(--ide-text-secondary)] uppercase tracking-widest font-black">Project:</span>
                            <span className="text-xs text-indigo-400 font-bold">{projectName}</span>
                        </div>
                    </div>
                </div>

                {phase !== 'analyzing' && phase !== 'refining' && (
                    <button
                        onClick={onCancel}
                        className="h-9 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-[var(--ide-text-muted)] hover:text-white transition-all text-xs font-bold"
                    >
                        {fullScreen ? 'Back' : '✕'}
                    </button>
                )}
            </div>

            <div className={`flex-1 min-h-0 ${fullScreen ? 'p-4 md:p-5' : 'p-6 overflow-y-auto custom-scrollbar'}`}>
                {phase === 'input' && (
                    <div className="h-full flex flex-col space-y-4 animate-fade-in">
                        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 flex items-start gap-4">
                            <div className="text-xl">💡</div>
                            <div className="text-sm text-indigo-200">
                                <strong className="block text-indigo-400 mb-1">Refine your idea with product + technical guidance.</strong>
                                Provide context, constraints, and goals. The AI will analyze viability, discuss tradeoffs, then draft a polished PRD.
                            </div>
                        </div>

                        <textarea
                            value={idea}
                            onChange={(e) => setIdea(e.target.value)}
                            placeholder="Describe the problem, users, value proposition, and must-have features..."
                            className="flex-1 w-full bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded-2xl p-5 text-[var(--ide-text)] text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all resize-none shadow-inner"
                        />

                        <div className="text-right text-[11px] text-[var(--ide-text-muted)] font-medium">
                            {idea.trim().length} characters
                        </div>
                    </div>
                )}

                {(phase === 'analyzing' || phase === 'refining') && (
                    <div className="h-full flex flex-col items-center justify-center space-y-6 animate-fade-in">
                        <div className="relative">
                            <div className="w-24 h-24 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center text-3xl">🤖</div>
                            <div className="absolute -inset-8 bg-indigo-500/10 blur-[30px] rounded-full animate-pulse z-[-1]" />
                        </div>
                        <div className="text-center space-y-2">
                            <h3 className="text-xl font-black text-white">
                                {phase === 'analyzing' ? 'Analyzing your idea...' : 'Drafting PRD document...'}
                            </h3>
                            <p className="text-sm text-[var(--ide-text-secondary)] animate-pulse">
                                {phase === 'analyzing'
                                    ? 'Scoring viability, strengths, risks, and next questions.'
                                    : 'Converting your discussion into a polished, implementation-ready document.'}
                            </p>
                        </div>
                    </div>
                )}

                {phase === 'discussion' && analysis && (
                    <div
                        className={`h-full min-h-0 animate-fade-in ${
                            fullScreen ? 'grid grid-cols-1 xl:grid-cols-[360px,1fr] gap-4' : 'flex flex-col space-y-6'
                        }`}
                    >
                        <div
                            className={`space-y-4 ${
                                fullScreen ? 'min-h-0 overflow-y-auto custom-scrollbar pr-1' : 'shrink-0'
                            }`}
                        >
                            <div className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/5 rounded-2xl p-5 relative overflow-hidden">
                                <div className="absolute -inset-4 bg-indigo-500/5 blur-xl" />
                                <div className="relative z-10">
                                    <div className="text-xs font-black text-[var(--ide-text-secondary)] uppercase tracking-widest mb-2">
                                        Viability Score
                                    </div>
                                    <div className={`text-5xl font-black ${getScoreColor(Number(analysis.score || 0))}`}>
                                        {analysis.score ?? 0}
                                    </div>
                                    <p className="text-xs text-[var(--ide-text-muted)] mt-3 italic">
                                        "{analysis.summary || 'No summary provided.'}"
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4">
                                    <div className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-2">Strengths</div>
                                    <ul className="space-y-1.5">
                                        {(analysis.strengths || []).map((s: string, i: number) => (
                                            <li key={i} className="text-xs text-[var(--ide-text-secondary)] flex items-start gap-2">
                                                <span className="text-emerald-500/50 mt-0.5">•</span>
                                                {s}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-4">
                                    <div className="text-xs font-black text-rose-400 uppercase tracking-widest mb-2">Risks</div>
                                    <ul className="space-y-1.5">
                                        {(analysis.weaknesses || []).map((w: string, i: number) => (
                                            <li key={i} className="text-xs text-[var(--ide-text-secondary)] flex items-start gap-2">
                                                <span className="text-rose-500/50 mt-0.5">•</span>
                                                {w}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-2xl p-4">
                                <div className="text-xs font-black text-cyan-400 uppercase tracking-widest mb-2">Questions</div>
                                <div className="flex flex-wrap gap-2">
                                    {(analysis.questions || []).map((q: string, i: number) => (
                                        <button
                                            key={i}
                                            onClick={() => handleQuickPrompt(q)}
                                            className="px-2.5 py-1 bg-cyan-500/10 text-cyan-200 text-[11px] rounded-lg border border-cyan-500/20 hover:bg-cyan-500/20 transition-all"
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {renderChatPanel()}
                    </div>
                )}

                {phase === 'complete' && (
                    <div className="h-full flex flex-col space-y-4 animate-fade-in">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg">✓</div>
                                <div>
                                    <div className="text-sm font-bold text-emerald-400">Draft Complete</div>
                                    <div className="text-xs text-emerald-500/70">Review, copy, download, or finalize.</div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 min-h-0 bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded-2xl p-6 overflow-y-auto custom-scrollbar shadow-inner">
                            <div
                                className="prose prose-invert prose-indigo max-w-none"
                                dangerouslySetInnerHTML={{ __html: marked.parse(refinedIdea, { async: false }) as string }}
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className={`flex-shrink-0 p-4 border-t border-[var(--ide-border)] bg-black/20 flex gap-3 ${fullScreen ? 'justify-between' : 'justify-end'} ${fullScreen ? '' : 'rounded-b-3xl'}`}>
                <div className="flex items-center gap-2">
                    {phase === 'discussion' && (
                        <button
                            onClick={runAnalyze}
                            className="h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-all text-xs font-bold"
                        >
                            Re-analyze
                        </button>
                    )}

                    {phase === 'complete' && (
                        <>
                            <button
                                onClick={handleCopyMarkdown}
                                className="h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-all text-xs font-bold"
                            >
                                {copied ? 'Copied' : 'Copy Markdown'}
                            </button>
                            <button
                                onClick={handleDownloadMarkdown}
                                className="h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-all text-xs font-bold"
                            >
                                Download .md
                            </button>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {phase === 'input' && (
                        <button
                            onClick={runAnalyze}
                            disabled={!idea.trim()}
                            className="btn-modern-primary !h-10 !px-8 text-xs disabled:opacity-50"
                        >
                            Analyze Idea
                        </button>
                    )}

                    {phase === 'discussion' && (
                        <button
                            onClick={handleRefine}
                            className="btn-modern-primary !h-10 !px-8 text-xs !bg-gradient-to-r !from-emerald-500 !to-teal-500 hover:!from-emerald-400 hover:!to-teal-400 !shadow-emerald-500/20"
                        >
                            Accept & Draft Document
                        </button>
                    )}

                    {phase === 'complete' && (
                        <button
                            onClick={() => onRefined(refinedIdea)}
                            className="btn-modern-primary !h-10 !px-8 text-xs !bg-gradient-to-r !from-emerald-500 !to-teal-500 hover:!from-emerald-400 hover:!to-teal-400 !shadow-emerald-500/20"
                        >
                            Finalize & Save
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
