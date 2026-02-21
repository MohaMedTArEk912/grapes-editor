/**
 * ProjectDashboard — In-project landing page
 *
 * Shows project overview and feature navigation as premium cards.
 */

import React from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { setActivePage, closeProject } from "../../stores/projectStore";
import type { FeaturePage } from "../../stores/projectStore";

/* ─── Feature Card Definitions ─── */
interface FeatureCard {
    id: FeaturePage;
    label: string;
    description: string;
    icon: string;
    accent: string;   // Tailwind accent color name
    gradient: string;  // Card gradient
}

const FEATURES: FeatureCard[] = [
    {
        id: "ui",
        label: "UI Design",
        description: "Visual drag-and-drop interface builder with live preview",
        icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
        accent: "indigo",
        gradient: "from-indigo-600/20 via-purple-600/10 to-transparent",
    },
    {
        id: "usecases",
        label: "Use Cases",
        description: "Logic flows and business process workflows",
        icon: "M13 10V3L4 14h7v7l9-11h-7z",
        accent: "amber",
        gradient: "from-amber-600/20 via-orange-600/10 to-transparent",
    },
    {
        id: "apis",
        label: "APIs",
        description: "RESTful endpoints, request/response schemas",
        icon: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9",
        accent: "emerald",
        gradient: "from-emerald-600/20 via-green-600/10 to-transparent",
    },
    {
        id: "database",
        label: "Database",
        description: "Entity-Relationship diagrams and data models",
        icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
        accent: "cyan",
        gradient: "from-cyan-600/20 via-blue-600/10 to-transparent",
    },
    {
        id: "diagrams",
        label: "Diagrams",
        description: "Architecture diagrams and system design",
        icon: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2",
        accent: "rose",
        gradient: "from-rose-600/20 via-pink-600/10 to-transparent",
    },
    {
        id: "code",
        label: "Source Code & Git",
        description: "File explorer, code editor, diff viewer, and version control",
        icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
        accent: "violet",
        gradient: "from-violet-600/20 via-fuchsia-600/10 to-transparent",
    },
];

const ACCENT_MAP: Record<string, { icon: string; ring: string; shadow: string }> = {
    indigo: { icon: "text-indigo-400", ring: "hover:ring-indigo-500/40", shadow: "hover:shadow-indigo-500/10" },
    amber: { icon: "text-amber-400", ring: "hover:ring-amber-500/40", shadow: "hover:shadow-amber-500/10" },
    emerald: { icon: "text-emerald-400", ring: "hover:ring-emerald-500/40", shadow: "hover:shadow-emerald-500/10" },
    cyan: { icon: "text-cyan-400", ring: "hover:ring-cyan-500/40", shadow: "hover:shadow-cyan-500/10" },
    rose: { icon: "text-rose-400", ring: "hover:ring-rose-500/40", shadow: "hover:shadow-rose-500/10" },
    violet: { icon: "text-violet-400", ring: "hover:ring-violet-500/40", shadow: "hover:shadow-violet-500/10" },
};

const ProjectDashboard: React.FC = () => {
    const { project } = useProjectStore();

    return (
        <div className="h-full w-full overflow-auto bg-[var(--ide-bg)]">
            <div className="max-w-5xl mx-auto px-8 py-10">

                {/* Header */}
                <div className="flex items-center justify-between mb-10">
                    <div>
                        <h1 className="text-3xl font-extrabold text-[var(--ide-text)] tracking-tight">
                            {project?.name || "Project"}
                        </h1>
                        <p className="text-sm text-[var(--ide-text-muted)] mt-1">
                            Select a feature to get started
                        </p>
                    </div>
                    <button
                        onClick={closeProject}
                        className="px-4 py-2 text-xs font-medium rounded-lg bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:border-[var(--ide-border-strong)] transition-colors"
                    >
                        ← Back to Projects
                    </button>
                </div>

                {/* Feature Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {FEATURES.map((feature) => {
                        const colors = ACCENT_MAP[feature.accent] || ACCENT_MAP.indigo;
                        return (
                            <button
                                key={feature.id}
                                onClick={() => setActivePage(feature.id)}
                                className={`group relative text-left p-6 rounded-2xl border border-white/[0.06] bg-gradient-to-br ${feature.gradient} backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] ring-1 ring-transparent ${colors.ring} ${colors.shadow} hover:shadow-xl`}
                            >
                                {/* Subtle glow effect */}
                                <div className="absolute inset-0 rounded-2xl bg-white/[0.02] group-hover:bg-white/[0.04] transition-colors" />

                                {/* Content */}
                                <div className="relative">
                                    {/* Icon */}
                                    <div className={`w-11 h-11 rounded-xl bg-white/[0.06] flex items-center justify-center mb-4 group-hover:bg-white/[0.10] transition-all duration-300 group-hover:scale-110 ${colors.icon}`}>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={feature.icon} />
                                        </svg>
                                    </div>

                                    {/* Label */}
                                    <h3 className="text-sm font-bold text-[var(--ide-text)] mb-1.5 group-hover:text-white transition-colors">
                                        {feature.label}
                                    </h3>

                                    {/* Description */}
                                    <p className="text-[11px] text-[var(--ide-text-muted)] leading-relaxed group-hover:text-[var(--ide-text-secondary)] transition-colors">
                                        {feature.description}
                                    </p>
                                </div>

                                {/* Arrow indicator */}
                                <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-1 group-hover:translate-x-0">
                                    <svg className="w-4 h-4 text-[var(--ide-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Quick Stats */}
                {project && (
                    <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <StatCard label="Pages" value={project.pages?.filter(p => !p.archived).length ?? 0} icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        <StatCard label="APIs" value={project.apis?.filter(a => !a.archived).length ?? 0} icon="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3" />
                        <StatCard label="Logic Flows" value={project.logic_flows?.filter(f => !f.archived).length ?? 0} icon="M13 10V3L4 14h7v7l9-11h-7z" />
                        <StatCard label="Models" value={project.data_models?.filter(m => !m.archived).length ?? 0} icon="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7" />
                    </div>
                )}
            </div>
        </div>
    );
};

/* ─── Stats Card ─── */
const StatCard: React.FC<{ label: string; value: number; icon: string }> = ({ label, value, icon }) => (
    <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-4 flex items-center gap-3 hover:bg-white/[0.05] transition-colors">
        <div className="w-9 h-9 rounded-lg bg-white/[0.05] flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-[var(--ide-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={icon} />
            </svg>
        </div>
        <div>
            <div className="text-lg font-bold text-[var(--ide-text)]">{value}</div>
            <div className="text-[9px] uppercase tracking-wider text-[var(--ide-text-muted)]">{label}</div>
        </div>
    </div>
);

export default ProjectDashboard;
