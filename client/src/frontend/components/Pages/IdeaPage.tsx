/**
 * IdeaPage — View and edit the project idea/description
 */

import React, { useState, useEffect } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import axios from "axios";
import IdeaWorkshop from "./IdeaWorkshop";

const API_BASE = "http://localhost:3001/api";

const IdeaPage: React.FC = () => {
    const { project } = useProjectStore();
    const [idea, setIdea] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [activeTab, setActiveTab] = useState<"idea" | "workshop">("idea");

    useEffect(() => {
        if (project) {
            setIdea(project.description || "");
        }
    }, [project]);

    const handleSave = async () => {
        if (!project) return;
        setSaving(true);
        try {
            await axios.put(`${API_BASE}/project/${project.id}/idea`, { idea });
            setSaved(true);
            setIsEditing(false);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error("Failed to save idea:", err);
        } finally {
            setSaving(false);
        }
    };

    const handleWorkshopRefined = async (refinedIdea: string) => {
        if (!project) return;
        setIdea(refinedIdea);
        setActiveTab("idea");
        setSaving(true);
        try {
            await axios.put(`${API_BASE}/project/${project.id}/idea`, { idea: refinedIdea });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error("Failed to save refined idea:", err);
        } finally {
            setSaving(false);
        }
    };

    if (!project) return null;

    return (
        <div className="h-full w-full overflow-auto relative" style={{ background: "#0a0a0f" }}>
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div
                    className="absolute w-[500px] h-[500px] rounded-full opacity-25 blur-[120px]"
                    style={{
                        background: "radial-gradient(circle, #f59e0b 0%, transparent 70%)",
                        top: "-10%",
                        right: "10%",
                        animation: "float1 20s ease-in-out infinite",
                    }}
                />
                <div
                    className="absolute w-[400px] h-[400px] rounded-full opacity-20 blur-[100px]"
                    style={{
                        background: "radial-gradient(circle, #6366f1 0%, transparent 70%)",
                        bottom: "10%",
                        left: "5%",
                        animation: "float2 25s ease-in-out infinite",
                    }}
                />
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
                        backgroundSize: "60px 60px",
                    }}
                />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto px-8 py-10">
                {/* Header */}
                <div className="mb-8" style={{ animation: "fadeSlideUp 0.5s ease-out both" }}>
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center">
                            <span className="text-2xl">💡</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-extrabold text-white tracking-tight">Project Idea</h1>
                            <p className="text-xs text-white/30 uppercase tracking-[0.2em] mt-0.5">{project.name}</p>
                        </div>
                    </div>
                </div>

                {/* Idea / Workshop tabs */}
                <div
                    className="mb-6 flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1 w-fit"
                    style={{ animation: "fadeSlideUp 0.5s ease-out 0.15s both" }}
                >
                    <button
                        onClick={() => setActiveTab("idea")}
                        className={`h-9 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                            activeTab === "idea"
                                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20"
                                : "text-white/50 hover:text-white hover:bg-white/10"
                        }`}
                    >
                        Idea
                    </button>
                    <button
                        onClick={() => setActiveTab("workshop")}
                        className={`h-9 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                            activeTab === "workshop"
                                ? "bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-lg shadow-indigo-500/20"
                                : "text-white/50 hover:text-white hover:bg-white/10"
                        }`}
                    >
                        AI Workshop
                    </button>
                </div>

                {activeTab === "idea" && (
                    <>
                        {/* Idea Card */}
                        <div
                            className="relative bg-white/[0.04] border border-white/[0.08] rounded-3xl overflow-hidden backdrop-blur-xl"
                            style={{ animation: "fadeSlideUp 0.5s ease-out 0.2s both" }}
                        >
                            {/* Top gradient accent */}
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500" />

                            <div className="p-8 md:p-10">
                                {/* Controls */}
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">
                                            {isEditing ? "Editing" : "Viewing"}
                                        </span>
                                        {saved && (
                                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest animate-fade-in">
                                                ✓ Saved
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isEditing ? (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        setIsEditing(false);
                                                        setIdea(project.description || "");
                                                    }}
                                                    className="px-4 py-2 text-xs font-bold rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleSave}
                                                    disabled={saving}
                                                    className="px-6 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
                                                >
                                                    {saving ? "Saving..." : "Save Idea"}
                                                </button>
                                            </>
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => setActiveTab("workshop")}
                                                    className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/20 hover:border-indigo-500/40 transition-all flex items-center gap-2"
                                                >
                                                    <span className="text-sm">✨</span>
                                                    Improve with AI
                                                </button>
                                                <button
                                                    onClick={() => setIsEditing(true)}
                                                    className="px-4 py-2 text-xs font-bold rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all flex items-center gap-2"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                    Edit
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Content */}
                                {isEditing ? (
                                    <textarea
                                        value={idea}
                                        onChange={(e) => setIdea(e.target.value)}
                                        autoFocus
                                        rows={12}
                                        placeholder="Describe your project idea in detail... What problem does it solve? Who is it for? What are the key features and goals?"
                                        className="w-full bg-black/30 border border-white/10 rounded-2xl px-6 py-5 text-white/90 text-[15px] leading-[1.8] focus:outline-none focus:border-amber-500/40 focus:ring-2 focus:ring-amber-500/10 transition-all placeholder:text-white/20 resize-none custom-scrollbar font-medium"
                                    />
                                ) : (
                                    <div className="min-h-[200px]">
                                        {idea ? (
                                            <div className="text-white/80 text-[15px] leading-[1.8] whitespace-pre-wrap font-medium">{idea}</div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                                <span className="text-5xl mb-4 opacity-30">💡</span>
                                                <h3 className="text-lg font-bold text-white/40 mb-2">No idea yet</h3>
                                                <p className="text-sm text-white/20 max-w-sm mb-6">
                                                    Click "Edit" to describe your project idea. This will also power your AI assistant's context.
                                                </p>
                                                <button
                                                    onClick={() => setIsEditing(true)}
                                                    className="px-6 py-3 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90 transition-all shadow-lg shadow-amber-500/20"
                                                >
                                                    Write Your Idea
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* AI Context Info */}
                        <div
                            className="mt-6 flex items-start gap-3 p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl"
                            style={{ animation: "fadeSlideUp 0.5s ease-out 0.4s both" }}
                        >
                            <span className="text-lg mt-0.5">🤖</span>
                            <div>
                                <p className="text-xs font-bold text-indigo-400 mb-1">AI Context</p>
                                <p className="text-[11px] text-white/40 leading-relaxed">
                                    Your project idea is used as context for the floating AI bot. The bot will understand your project and give relevant advice based on what you've described here.
                                </p>
                            </div>
                        </div>
                    </>
                )}

                {activeTab === "workshop" && (
                    <div style={{ animation: "fadeSlideUp 0.5s ease-out 0.2s both" }}>
                        <IdeaWorkshop
                            projectName={project.name}
                            projectId={project.id}
                            initialIdea={idea}
                            onRefined={handleWorkshopRefined}
                            onCancel={() => setActiveTab("idea")}
                        />
                    </div>
                )}
            </div>

            <style>{`
                @keyframes float1 { 0%, 100% { transform: translate(0,0) scale(1); } 33% { transform: translate(80px,40px) scale(1.1); } 66% { transform: translate(-40px,60px) scale(.95); } }
                @keyframes float2 { 0%, 100% { transform: translate(0,0) scale(1); } 33% { transform: translate(-60px,-30px) scale(1.05); } 66% { transform: translate(30px,-50px) scale(.9); } }
                @keyframes fadeSlideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
            `}</style>
        </div>
    );
};

export default IdeaPage;
