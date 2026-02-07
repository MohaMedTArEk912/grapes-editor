/**
 * Toolbar Component - VS Code Style Tab Bar
 *
 * Pages shown as file-style tabs. "+" button to add a new page.
 */

import React, { useState } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { createPage, selectPage } from "../../stores/projectStore";
import PromptModal from "../UI/PromptModal";
import { useToast } from "../../context/ToastContext";

const Toolbar: React.FC = () => {
    const { project, selectedPageId, activeTab, editMode } = useProjectStore();
    const [createPageModalOpen, setCreatePageModalOpen] = useState(false);
    const toast = useToast();
    const pages = project?.pages.filter((page) => !page.archived) ?? [];

    const handleCreatePage = () => {
        setCreatePageModalOpen(true);
    };

    const submitCreatePage = async (values: Record<string, string>) => {
        const pageName = values.pageName?.trim();
        if (!pageName) return;
        try {
            await createPage(pageName);
            toast.success(`Page "${pageName}" created`);
        } catch (err) {
            console.error("Failed to create page:", err);
            toast.error(`Failed to create page: ${err}`);
        }
    };

    return (
        <>
            <div className="w-full h-full flex items-center bg-[var(--ide-chrome)]">
                {/* Page tabs (visual mode only) */}
                {activeTab === "canvas" && editMode === "visual" && (
                    <div className="flex items-center h-full overflow-x-auto">
                        {pages.map((page) => {
                            const active = page.id === selectedPageId;
                            return (
                                <button
                                    key={page.id}
                                    onClick={() => selectPage(page.id)}
                                    className={[
                                        "h-full px-4 text-xs font-medium border-r border-[var(--ide-border)] transition-colors whitespace-nowrap flex items-center gap-1.5",
                                        active
                                            ? "bg-[var(--ide-bg)] text-[var(--ide-text)] border-b-2 border-b-[var(--ide-primary)]"
                                            : "text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-bg-elevated)]",
                                    ].join(" ")}
                                >
                                    <svg className="w-3.5 h-3.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    {page.name}
                                </button>
                            );
                        })}

                        {/* Add page button */}
                        <button
                            onClick={handleCreatePage}
                            className="h-full w-9 flex items-center justify-center text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-bg-elevated)] transition-colors border-r border-[var(--ide-border)]"
                            title="New Page"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                    </div>
                )}

                {/* Non-canvas tab labels */}
                {activeTab === "logic" && (
                    <div className="h-full px-4 flex items-center text-xs font-medium text-[var(--ide-text)] bg-[var(--ide-bg)] border-r border-[var(--ide-border)] border-b-2 border-b-[var(--ide-primary)]">
                        Logic
                    </div>
                )}
                {activeTab === "api" && (
                    <div className="h-full px-4 flex items-center text-xs font-medium text-[var(--ide-text)] bg-[var(--ide-bg)] border-r border-[var(--ide-border)] border-b-2 border-b-[var(--ide-primary)]">
                        API
                    </div>
                )}
                {activeTab === "erd" && (
                    <div className="h-full px-4 flex items-center text-xs font-medium text-[var(--ide-text)] bg-[var(--ide-bg)] border-r border-[var(--ide-border)] border-b-2 border-b-[var(--ide-primary)]">
                        Schema
                    </div>
                )}
                {activeTab === "canvas" && editMode === "code" && (
                    <div className="h-full px-4 flex items-center text-xs font-medium text-[var(--ide-text)] bg-[var(--ide-bg)] border-r border-[var(--ide-border)] border-b-2 border-b-[var(--ide-primary)]">
                        Code
                    </div>
                )}
            </div>

            <PromptModal
                isOpen={createPageModalOpen}
                title="Create New Page"
                confirmText="Create"
                fields={[
                    {
                        name: "pageName",
                        label: "Page Name",
                        placeholder: "New Page",
                        value: "New Page",
                        required: true,
                    },
                ]}
                onClose={() => setCreatePageModalOpen(false)}
                onSubmit={submitCreatePage}
            />
        </>
    );
};

export default Toolbar;
