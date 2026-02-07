import React, { useState, useEffect } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { renameProject, resetProject, deleteProject, closeProject } from "../../stores/projectStore";
import { useToast } from "../../context/ToastContext";
import ConfirmModal from "./ConfirmModal";

interface ProjectSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({ isOpen, onClose }) => {
    const { project } = useProjectStore();
    const [projectName, setProjectName] = useState(project?.name || "");
    const [isSaving, setIsSaving] = useState(false);
    const [isDestructiveAction, setIsDestructiveAction] = useState(false);
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        type: "reset" | "delete" | null;
    }>({ isOpen: false, type: null });
    const toast = useToast();

    useEffect(() => {
        if (project) {
            setProjectName(project.name);
        }
    }, [project]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!projectName.trim()) {
            toast.error("Project name cannot be empty");
            return;
        }

        setIsSaving(true);
        try {
            if (projectName !== project?.name) {
                await renameProject(projectName.trim());
            }
            toast.success("Settings saved successfully");
            onClose();
        } catch (err) {
            toast.error(`Failed to save settings: ${err}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetConfirm = async () => {
        setIsDestructiveAction(true);
        try {
            await resetProject();
            toast.success("Project reset to initial state");
            setConfirmModal({ isOpen: false, type: null });
            onClose();
        } catch (err) {
            toast.error(`Failed to reset project: ${err}`);
        } finally {
            setIsDestructiveAction(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!project) return;
        setIsDestructiveAction(true);
        try {
            await deleteProject(project.id);
            toast.success("Project deleted successfully");
            closeProject();
            setConfirmModal({ isOpen: false, type: null });
            onClose();
        } catch (err) {
            toast.error(`Failed to delete project: ${err}`);
        } finally {
            setIsDestructiveAction(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-ide-panel border border-ide-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden glass">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-ide-border flex items-center justify-between bg-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <circle cx="12" cy="12" r="3" strokeWidth="2" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-white">Project Settings</h3>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-ide-text-muted transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                        {/* Basic Info */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-ide-text-muted uppercase tracking-wider block">
                                    Project Name
                                </label>
                                <input
                                    type="text"
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    className="w-full bg-black/40 border border-ide-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all hover:bg-black/60"
                                />
                            </div>
                        </div>

                        {/* Danger Zone */}
                        <div className="pt-4 border-t border-red-500/20 space-y-4">
                            <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Danger Zone
                            </h4>

                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setConfirmModal({ isOpen: true, type: "reset" })}
                                    disabled={isDestructiveAction}
                                    className="flex flex-col items-center justify-center p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 hover:bg-yellow-500/10 transition-all group"
                                >
                                    <svg className="w-6 h-6 text-yellow-500/60 group-hover:text-yellow-500 mb-2 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    <span className="text-xs font-bold text-yellow-500/80 group-hover:text-yellow-500 uppercase">Reset Content</span>
                                    <span className="text-[10px] text-ide-text-muted mt-1 text-center">Delete all pages & blocks</span>
                                </button>

                                <button
                                    onClick={() => setConfirmModal({ isOpen: true, type: "delete" })}
                                    disabled={isDestructiveAction}
                                    className="flex flex-col items-center justify-center p-4 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-all group"
                                >
                                    <svg className="w-6 h-6 text-red-500/60 group-hover:text-red-500 mb-2 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    <span className="text-xs font-bold text-red-500/80 group-hover:text-red-500 uppercase">Delete Project</span>
                                    <span className="text-[10px] text-ide-text-muted mt-1 text-center">Permanent removal</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-black/20 border-t border-ide-border flex items-center justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="btn-ghost !px-6 h-10 font-bold"
                            disabled={isSaving || isDestructiveAction}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="btn-primary !px-8 h-10 font-bold shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                            disabled={isSaving || isDestructiveAction}
                        >
                            {isSaving ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Saving...
                                </>
                            ) : (
                                "Save Changes"
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Confirmation Modals */}
            <ConfirmModal
                isOpen={confirmModal.isOpen && confirmModal.type === "reset"}
                title="Reset Project Content"
                message="This will permanently delete ALL content (pages, blocks, logic) in this project. The project folder will be reset to a fresh starter template. This cannot be undone."
                confirmText="Reset Everything"
                variant="warning"
                onConfirm={handleResetConfirm}
                onCancel={() => setConfirmModal({ isOpen: false, type: null })}
                isLoading={isDestructiveAction}
            />

            <ConfirmModal
                isOpen={confirmModal.isOpen && confirmModal.type === "delete"}
                title={`Delete "${project?.name}"?`}
                message="This will permanently remove the project from the database and close the editor. The generated code on disk will NOT be deleted."
                confirmText="Delete Project"
                variant="danger"
                onConfirm={handleDeleteConfirm}
                onCancel={() => setConfirmModal({ isOpen: false, type: null })}
                isLoading={isDestructiveAction}
            />
        </>
    );
};

export default ProjectSettingsModal;

