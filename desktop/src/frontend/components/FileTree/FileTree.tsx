import React, { useState, useEffect, useCallback } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { useApi, FileEntry } from "../../hooks/useTauri";
import { refreshCurrentProject, selectFile } from "../../stores/projectStore";
import PromptModal from "../UI/PromptModal";
import ConfirmModal from "../Modals/ConfirmModal";
import { useToast } from "../../context/ToastContext";

interface FileTreeItemProps {
    entry: FileEntry;
    depth: number;
    onRefresh: () => void;
    onFileSelect: (path: string) => void;
    selectedPath: string | null;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({
    entry,
    depth,
    onRefresh,
    onFileSelect,
    selectedPath,
}) => {
    const [expanded, setExpanded] = useState(false);
    const [children, setChildren] = useState<FileEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const [createModalType, setCreateModalType] = useState<"file" | "folder" | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [newName, setNewName] = useState(entry.name);

    const api = useApi();
    const toast = useToast();
    const isSelected = selectedPath === entry.path;

    // Load children when expanded
    useEffect(() => {
        if (entry.is_directory && expanded && children.length === 0) {
            loadChildren();
        }
    }, [expanded, entry.is_directory]);

    const loadChildren = async () => {
        if (!entry.is_directory) return;
        setLoading(true);
        try {
            const result = await api.listDirectory(entry.path);
            setChildren(result.entries);
        } catch (err) {
            console.error("Failed to load directory:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleClick = () => {
        if (entry.is_directory) {
            setExpanded(!expanded);
            if (!expanded && children.length === 0) {
                loadChildren();
            }
        } else {
            onFileSelect(entry.path);
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    const closeContextMenu = () => setContextMenu(null);

    const getParentPath = () => (entry.is_directory ? entry.path : entry.path.split("/").slice(0, -1).join("/"));

    const handleNewFile = () => {
        closeContextMenu();
        setCreateModalType("file");
    };

    const handleNewFolder = () => {
        closeContextMenu();
        setCreateModalType("folder");
    };

    const handleCreateEntry = async (values: Record<string, string>) => {
        const name = values.name?.trim();
        if (!name || !createModalType) return;

        const parentPath = getParentPath();
        const newPath = parentPath ? `${parentPath}/${name}` : name;

        try {
            if (createModalType === "file") {
                await api.createFile(newPath, "");
                toast.success(`File "${name}" created`);
            } else {
                await api.createFolder(newPath);
                toast.success(`Folder "${name}" created`);
            }
            onRefresh();
        } catch (err) {
            const resource = createModalType === "file" ? "file" : "folder";
            toast.error(`Failed to create ${resource}: ${err}`);
        }
    };

    const handleRename = () => {
        closeContextMenu();
        setIsRenaming(true);
        setNewName(entry.name);
    };

    const submitRename = async () => {
        if (!newName.trim() || newName === entry.name) {
            setIsRenaming(false);
            return;
        }

        try {
            const parentPath = entry.path.split("/").slice(0, -1).join("/");
            const newPath = parentPath ? `${parentPath}/${newName}` : newName;
            await api.renameFile(entry.path, newPath);
            setIsRenaming(false);
            toast.success(`Renamed to "${newName}"`);
            onRefresh();
        } catch (err) {
            toast.error(`Failed to rename: ${err}`);
            setIsRenaming(false);
        }
    };

    const handleDelete = () => {
        closeContextMenu();
        setDeleteConfirmOpen(true);
    };

    const confirmDelete = async () => {
        setIsDeleting(true);
        try {
            await api.deleteFile(entry.path);
            toast.success(`${entry.is_directory ? "Folder" : "File"} "${entry.name}" deleted`);
            setDeleteConfirmOpen(false);
            onRefresh();
        } catch (err) {
            toast.error(`Failed to delete: ${err}`);
        } finally {
            setIsDeleting(false);
        }
    };

    const getFileIcon = (): string => {
        if (entry.is_directory) {
            return expanded
                ? "M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
                : "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z";
        }

        // File icons based on extension
        switch (entry.extension?.toLowerCase()) {
            case "ts":
            case "tsx":
                return "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4";
            case "js":
            case "jsx":
                return "M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25";
            case "json":
                return "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4";
            case "css":
            case "scss":
                return "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01";
            case "html":
                return "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4";
            case "md":
                return "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z";
            case "rs":
                return "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z";
            default:
                return "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z";
        }
    };

    return (
        <div className="select-none">
            <div
                className={`group flex items-center gap-1.5 px-2 py-1 cursor-pointer text-[13px] transition-colors ${isSelected
                    ? "bg-[var(--ide-text)]/10 text-[var(--ide-text)]"
                    : "text-[var(--ide-text-muted)] hover:bg-[var(--ide-text)]/5 hover:text-[var(--ide-text)]"
                    }`}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
            >
                {/* Expand/Collapse Arrow */}
                <div className="w-4 flex items-center justify-center flex-shrink-0">
                    {entry.is_directory && (
                        <svg
                            className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                    )}
                </div>

                {/* Icon */}
                <svg
                    className={`w-4 h-4 flex-shrink-0 ${entry.is_directory ? "text-[var(--ide-text-muted)]" : "text-[var(--ide-text-muted)]"}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={getFileIcon()} />
                </svg>

                {/* Name */}
                {isRenaming ? (
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onBlur={submitRename}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") submitRename();
                            if (e.key === "Escape") setIsRenaming(false);
                        }}
                        autoFocus
                        className="flex-1 bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-1 py-0.5 text-[13px] text-[var(--ide-text)] outline-none"
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span className={`truncate ${isSelected ? "font-medium" : ""}`}>
                        {entry.name}
                    </span>
                )}

                {/* Loading indicator */}
                {loading && (
                    <div className="w-3 h-3 border border-t-transparent border-[var(--ide-text-muted)] rounded-full animate-spin" />
                )}
            </div>

            {/* Children */}
            {entry.is_directory && expanded && (
                <div>
                    {children.map((child) => (
                        <FileTreeItem
                            key={child.path}
                            entry={child}
                            depth={depth + 1}
                            onRefresh={() => {
                                loadChildren();
                                onRefresh();
                            }}
                            onFileSelect={onFileSelect}
                            selectedPath={selectedPath}
                        />
                    ))}
                </div>
            )}

            {/* Context Menu */}
            {contextMenu && (
                <>
                    <div className="fixed inset-0 z-[99]" onClick={closeContextMenu} />
                    <div
                        className="fixed z-[100] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded-lg shadow-xl py-1 min-w-[160px]"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                    >
                        <button
                            onClick={handleNewFile}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-[var(--ide-text)] hover:bg-[var(--ide-text)]/10 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v16m8-8H4" />
                            </svg>
                            New File
                        </button>
                        <button
                            onClick={handleNewFolder}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-[var(--ide-text)] hover:bg-[var(--ide-text)]/10 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                            </svg>
                            New Folder
                        </button>
                        <div className="h-px bg-[var(--ide-border)] my-1" />
                        <button
                            onClick={handleRename}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-[var(--ide-text)] hover:bg-[var(--ide-text)]/10 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Rename
                        </button>
                        <button
                            onClick={handleDelete}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-red-500 hover:bg-red-500/10 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                        </button>
                    </div>
                </>
            )}

            <PromptModal
                isOpen={createModalType !== null}
                title={createModalType === "file" ? "Create New File" : "Create New Folder"}
                confirmText={createModalType === "file" ? "Create File" : "Create Folder"}
                fields={[
                    {
                        name: "name",
                        label: createModalType === "file" ? "File Name" : "Folder Name",
                        placeholder: createModalType === "file" ? "new-file.tsx" : "new-folder",
                        required: true,
                    },
                ]}
                onClose={() => setCreateModalType(null)}
                onSubmit={handleCreateEntry}
            />

            <ConfirmModal
                isOpen={deleteConfirmOpen}
                title={entry.is_directory ? "Delete Folder" : "Delete File"}
                message={entry.is_directory
                    ? `Delete "${entry.name}" and all nested files? This action cannot be undone.`
                    : `Delete "${entry.name}"? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
                isLoading={isDeleting}
                onConfirm={confirmDelete}
                onCancel={() => {
                    if (!isDeleting) {
                        setDeleteConfirmOpen(false);
                    }
                }}
            />
        </div>
    );
};

const FileTree: React.FC = () => {
    const { project, selectedFilePath } = useProjectStore();
    const [entries, setEntries] = useState<FileEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const api = useApi();

    const loadRootDirectory = useCallback(async () => {
        if (!project?.root_path) return;

        setLoading(true);
        setError(null);
        try {
            const result = await api.listDirectory();
            setEntries(result.entries);
        } catch (err) {
            console.error("Failed to load file tree:", err);
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }, [project?.root_path]);

    useEffect(() => {
        loadRootDirectory();
    }, [loadRootDirectory]);

    const handleFileSelect = (path: string) => {
        selectFile(path);
    };

    if (!project) {
        return (
            <div className="px-4 py-8 text-center">
                <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-[var(--ide-panel)] flex items-center justify-center text-[var(--ide-text-muted)]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                </div>
                <p className="text-[12px] font-medium text-[var(--ide-text-muted)]">No Project</p>
                <p className="mt-1 text-[11px] text-[var(--ide-text-muted)] opacity-60">
                    Open a project to browse files
                </p>
            </div>
        );
    }

    if (!project.root_path) {
        const handlePickFolder = async () => {
            try {
                const folder = await api.pickFolder();
                if (folder) {
                    await api.setProjectRoot(folder);
                    await refreshCurrentProject();
                }
            } catch (err) {
                console.error("Failed to set folder:", err);
            }
        };

        return (
            <div className="px-4 py-6 text-center">
                <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-[var(--ide-panel)] flex items-center justify-center text-[var(--ide-text-muted)]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                </div>
                <p className="text-[12px] font-medium text-[var(--ide-text)]">Set Project Folder</p>
                <p className="mt-1 text-[11px] text-[var(--ide-text-muted)]">
                    Choose where project files are stored
                </p>
                <button
                    onClick={handlePickFolder}
                    className="mt-3 px-4 py-1.5 text-[11px] font-medium bg-[var(--ide-text)] text-[var(--ide-bg)] rounded-md hover:opacity-90 transition-opacity"
                >
                    Choose Folder
                </button>
            </div>
        );
    }

    if (loading && entries.length === 0) {
        return (
            <div className="px-4 py-8 text-center">
                <div className="w-6 h-6 mx-auto mb-3 border-2 border-t-transparent border-[var(--ide-text-muted)] rounded-full animate-spin" />
                <p className="text-[11px] text-[var(--ide-text-muted)]">Loading files...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="px-4 py-8 text-center">
                <p className="text-[11px] text-red-500">Error: {error}</p>
                <button
                    onClick={loadRootDirectory}
                    className="mt-2 text-[11px] text-[var(--ide-text)] underline"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="py-1 flex flex-col h-full">
            {/* Header with refresh */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--ide-border)]">
                <span className="text-[11px] font-medium text-[var(--ide-text-muted)] uppercase tracking-wide">
                    Explorer
                </span>
                <button
                    onClick={loadRootDirectory}
                    className="p-1 rounded hover:bg-[var(--ide-text)]/10 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
                    title="Refresh"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>

            {/* File Tree */}
            <div className="flex-1 overflow-y-auto">
                {entries.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                        <p className="text-[11px] text-[var(--ide-text-muted)]">Empty directory</p>
                    </div>
                ) : (
                    entries.map((entry) => (
                        <FileTreeItem
                            key={entry.path}
                            entry={entry}
                            depth={0}
                            onRefresh={loadRootDirectory}
                            onFileSelect={handleFileSelect}
                            selectedPath={selectedFilePath}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default FileTree;
