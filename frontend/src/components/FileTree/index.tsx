import React, { useState, useCallback, useMemo } from 'react';
import {
    Folder,
    FolderOpen,
    File,
    FileCode,
    Layout,
    Box,
    Workflow,
    Database,
    Settings,
    Palette,
    Lock,
    ChevronRight,
    ChevronDown,
    MoreVertical,
    Trash2,
    Edit2,
    Copy,
    Archive,
    RotateCcw,
    ExternalLink
} from 'lucide-react';
import './FileTree.css';

// ============================================================================
// TYPES
// ============================================================================

export interface VFSFile {
    _id: string;
    id?: string;
    name: string;
    path: string;
    type: string;
    protection: 'protected' | 'semi_editable' | 'free_code';
    isArchived: boolean;
}

export interface FolderNode {
    name: string;
    path: string;
    children: FolderNode[];
    files: VFSFile[];
}

export interface FileTreeProps {
    tree: FolderNode;
    selectedPath?: string;
    onFileSelect: (file: VFSFile) => void;
    onFileAction: (file: VFSFile, action: FileAction) => void;
    currentFileId?: string;
}

export type FileAction =
    | 'open'
    | 'rename'
    | 'duplicate'
    | 'delete'
    | 'archive'
    | 'restore'
    | 'export';

// ============================================================================
// FILE ICON MAPPING
// ============================================================================

const FILE_ICONS: Record<string, React.ElementType> = {
    page: Layout,
    component: Box,
    comp: Box,
    flow: Workflow,
    store: Database,
    config: Settings,
    tokens: Palette,
    css: FileCode,
    js: FileCode,
    inject: FileCode,
};

const PROTECTION_STYLES: Record<string, { color: string; label: string }> = {
    protected: { color: 'var(--color-warning)', label: 'Managed by editor' },
    semi_editable: { color: 'var(--color-info)', label: 'Form-editable only' },
    free_code: { color: 'var(--color-success)', label: 'Freely editable' },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const FileTree: React.FC<FileTreeProps> = ({
    tree,
    selectedPath,
    onFileSelect,
    onFileAction,
    currentFileId,
}) => {
    return (
        <div className="file-tree" role="tree" aria-label="Project files">
            <FolderItem
                folder={tree}
                level={0}
                selectedPath={selectedPath}
                onFileSelect={onFileSelect}
                onFileAction={onFileAction}
                currentFileId={currentFileId}
            />
        </div>
    );
};

// ============================================================================
// FOLDER COMPONENT
// ============================================================================

interface FolderItemProps {
    folder: FolderNode;
    level: number;
    selectedPath?: string;
    onFileSelect: (file: VFSFile) => void;
    onFileAction: (file: VFSFile, action: FileAction) => void;
    currentFileId?: string;
}

const FolderItem: React.FC<FolderItemProps> = ({
    folder,
    level,
    selectedPath,
    onFileSelect,
    onFileAction,
    currentFileId,
}) => {
    const [isOpen, setIsOpen] = useState(level < 2);

    const hasChildren = folder.children.length > 0 || folder.files.length > 0;
    const paddingLeft = level * 12;

    const handleToggle = useCallback(() => {
        setIsOpen(prev => !prev);
    }, []);

    // Don't render root folder header
    if (level === 0) {
        return (
            <div className="folder-contents">
                {folder.children.map((child) => (
                    <FolderItem
                        key={child.path}
                        folder={child}
                        level={level + 1}
                        selectedPath={selectedPath}
                        onFileSelect={onFileSelect}
                        onFileAction={onFileAction}
                        currentFileId={currentFileId}
                    />
                ))}
                {folder.files.map((file) => (
                    <FileItem
                        key={file._id || file.path}
                        file={file}
                        level={level + 1}
                        isSelected={file.path === selectedPath}
                        isCurrent={file._id === currentFileId}
                        onSelect={onFileSelect}
                        onAction={onFileAction}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="folder-wrapper" role="treeitem" aria-expanded={isOpen}>
            <button
                className="folder-header"
                style={{ paddingLeft: `${paddingLeft}px` }}
                onClick={handleToggle}
                aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${folder.name} folder`}
            >
                <span className="folder-chevron">
                    {hasChildren ? (
                        isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                    ) : (
                        <span style={{ width: 14 }} />
                    )}
                </span>
                <span className="folder-icon">
                    {isOpen ? (
                        <FolderOpen size={16} />
                    ) : (
                        <Folder size={16} />
                    )}
                </span>
                <span className="folder-name">{folder.name}</span>
            </button>

            {isOpen && (
                <div className="folder-contents" role="group">
                    {folder.children.map((child) => (
                        <FolderItem
                            key={child.path}
                            folder={child}
                            level={level + 1}
                            selectedPath={selectedPath}
                            onFileSelect={onFileSelect}
                            onFileAction={onFileAction}
                            currentFileId={currentFileId}
                        />
                    ))}
                    {folder.files.map((file) => (
                        <FileItem
                            key={file._id || file.path}
                            file={file}
                            level={level + 1}
                            isSelected={file.path === selectedPath}
                            isCurrent={file._id === currentFileId}
                            onSelect={onFileSelect}
                            onAction={onFileAction}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// ============================================================================
// FILE COMPONENT
// ============================================================================

interface FileItemProps {
    file: VFSFile;
    level: number;
    isSelected: boolean;
    isCurrent: boolean;
    onSelect: (file: VFSFile) => void;
    onAction: (file: VFSFile, action: FileAction) => void;
}

const FileItem: React.FC<FileItemProps> = ({
    file,
    level,
    isSelected,
    isCurrent,
    onSelect,
    onAction,
}) => {
    const [showMenu, setShowMenu] = useState(false);

    const Icon = FILE_ICONS[file.type] || File;
    const protectionStyle = PROTECTION_STYLES[file.protection] || PROTECTION_STYLES.free_code;
    const isProtected = file.protection === 'protected';
    const canDelete = file.protection === 'free_code';
    const canRename = file.protection !== 'protected';

    const paddingLeft = (level + 1) * 12;

    const handleClick = useCallback(() => {
        onSelect(file);
    }, [file, onSelect]);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setShowMenu(true);
    }, []);

    const handleMenuClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setShowMenu(prev => !prev);
    }, []);

    const handleAction = useCallback((action: FileAction) => {
        onAction(file, action);
        setShowMenu(false);
    }, [file, onAction]);

    const closeMenu = useCallback(() => {
        setShowMenu(false);
    }, []);

    // Memoize menu items based on file permissions
    const menuItems = useMemo(() => {
        const items: Array<{
            icon: React.ElementType;
            label: string;
            action: FileAction;
            danger?: boolean;
            disabled?: boolean;
        }> = [
                { icon: ExternalLink, label: 'Open in Editor', action: 'open' },
                { icon: Copy, label: 'Duplicate', action: 'duplicate' },
            ];

        if (canRename) {
            items.push({ icon: Edit2, label: 'Rename', action: 'rename' });
        }

        items.push({ icon: ExternalLink, label: 'Export', action: 'export' });

        if (file.isArchived) {
            items.push({ icon: RotateCcw, label: 'Restore', action: 'restore' });
        } else if (canDelete) {
            items.push({ icon: Trash2, label: 'Delete', action: 'delete', danger: true });
        } else {
            items.push({ icon: Archive, label: 'Archive', action: 'archive' });
        }

        return items;
    }, [canRename, canDelete, file.isArchived]);

    return (
        <div
            className={`file-item ${isSelected ? 'selected' : ''} ${isCurrent ? 'current' : ''} ${file.isArchived ? 'archived' : ''}`}
            style={{ paddingLeft: `${paddingLeft}px` }}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            role="treeitem"
            aria-selected={isSelected}
            tabIndex={0}
        >
            <span
                className="file-icon"
                style={{ color: protectionStyle.color }}
                title={protectionStyle.label}
            >
                <Icon size={16} />
            </span>

            <span className="file-name" title={file.name}>
                {file.name}
            </span>

            {isCurrent && (
                <span className="file-badge current-badge" title="Currently editing">
                    •
                </span>
            )}

            {isProtected && (
                <span
                    className="file-lock"
                    title="Managed by editor"
                    aria-label="This file is managed by the editor"
                >
                    <Lock size={12} />
                </span>
            )}

            <button
                className="file-menu-trigger"
                onClick={handleMenuClick}
                aria-label="File actions"
                aria-haspopup="menu"
                aria-expanded={showMenu}
            >
                <MoreVertical size={14} />
            </button>

            {/* Context Menu */}
            {showMenu && (
                <>
                    <div
                        className="file-menu-backdrop"
                        onClick={closeMenu}
                        aria-hidden="true"
                    />
                    <div
                        className="file-context-menu"
                        role="menu"
                        aria-label="File actions"
                    >
                        {menuItems.map((item, index) => (
                            <button
                                key={item.action}
                                className={`menu-item ${item.danger ? 'danger' : ''} ${item.disabled ? 'disabled' : ''}`}
                                onClick={() => !item.disabled && handleAction(item.action)}
                                role="menuitem"
                                disabled={item.disabled}
                            >
                                <item.icon size={14} />
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default FileTree;
