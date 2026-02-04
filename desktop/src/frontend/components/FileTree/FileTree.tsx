/**
 * FileTree Component - React version
 * 
 * VS Code-style file tree navigation for the project's virtual files.
 * Updated to reflect the physical feature-based directory structure.
 */

import React, { useState } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { selectPage } from "../../stores/projectStore";

interface FileTreeItemProps {
    name: string;
    icon: string;
    entityId: string;
    isDirectory: boolean;
    children?: FileTreeItemProps[];
    depth: number;
    onClick?: () => void;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({
    name,
    icon,
    entityId,
    isDirectory,
    children,
    depth,
    onClick
}) => {
    const [expanded, setExpanded] = useState(true);
    const { selectedPageId } = useProjectStore();

    const handleClick = () => {
        if (isDirectory) {
            setExpanded(!expanded);
        } else if (onClick) {
            onClick();
        }
    };

    const isSelected = icon === "file-text" && !isDirectory && selectedPageId === entityId;

    const getIconPath = (iconName: string): string => {
        switch (iconName) {
            case "folder":
                return "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z";
            case "file-text":
                return "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z";
            case "box":
                return "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4";
            case "zap":
                return "M13 10V3L4 14h7v7l9-11h-7z";
            case "database":
                return "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4";
            case "git-branch":
                return "M6 3v12m0 0a3 3 0 103 3m-3-3a3 3 0 003-3h6m0 0a3 3 0 103 3m-3-3a3 3 0 00-3-3";
            default:
                return "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z";
        }
    };

    return (
        <div className="select-none">
            <div
                className={`group flex items-center gap-2 px-3 py-1.5 cursor-pointer text-[12px] transition-all border-l-2 ${isSelected
                    ? "bg-indigo-500/10 border-indigo-500 text-white"
                    : "border-transparent text-ide-text-muted hover:bg-white/5 hover:text-white"
                    }`}
                style={{ paddingLeft: `${depth * 12 + 12}px` }}
                onClick={handleClick}
            >
                {/* Expand/Collapse Arrow for directories */}
                <div className="w-3 flex items-center justify-center">
                    {isDirectory && (
                        <svg
                            className={`w-2.5 h-2.5 transition-transform ${expanded ? "rotate-90" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
                        </svg>
                    )}
                </div>

                {/* Icon */}
                <svg
                    className={`w-3.5 h-3.5 ${isDirectory ? "text-amber-400/80" : isSelected ? "text-indigo-400" : "text-ide-text-muted/60 group-hover:text-indigo-400"}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={getIconPath(icon)} />
                </svg>

                {/* Name */}
                <span className={`truncate ${isSelected ? "font-bold" : "font-medium"}`}>
                    {name}
                </span>
            </div>

            {/* Children */}
            {isDirectory && expanded && children && (
                <div className="animate-fade-in">
                    {children.map((child, index) => (
                        <FileTreeItem key={child.entityId + index} {...child} depth={depth + 1} />
                    ))}
                </div>
            )}
        </div>
    );
};

const FileTree: React.FC = () => {
    const { project } = useProjectStore();

    // Build file tree from project state - feature-based architecture
    const getFileTree = (): FileTreeItemProps[] => {
        if (!project) return [];

        const tree: FileTreeItemProps[] = [];

        // Client Source
        const clientPages: FileTreeItemProps[] = project.pages
            .filter((p) => !p.archived)
            .map((page) => ({
                name: `${page.name}.tsx`,
                icon: "file-text",
                entityId: page.id,
                isDirectory: false,
                depth: 2,
                onClick: () => selectPage(page.id),
            }));

        const clientFeatures: FileTreeItemProps[] = [
            {
                name: "pages",
                icon: "folder",
                entityId: "client-pages",
                isDirectory: true,
                children: clientPages,
                depth: 1,
            }
        ];

        tree.push({
            name: "client",
            icon: "folder",
            entityId: "client-root",
            isDirectory: true,
            children: [
                {
                    name: "src",
                    icon: "folder",
                    entityId: "client-src",
                    isDirectory: true,
                    children: clientFeatures,
                    depth: 1,
                }
            ],
            depth: 0,
        });

        // Server Source
        const serverRoutes: FileTreeItemProps[] = project.apis
            .filter((a) => !a.archived)
            .map((api) => ({
                name: `${api.name.toLowerCase()}.service.ts`,
                icon: "zap",
                entityId: api.id,
                isDirectory: false,
                depth: 2,
            }));

        tree.push({
            name: "server",
            icon: "folder",
            entityId: "server-root",
            isDirectory: true,
            children: [
                {
                    name: "src",
                    icon: "folder",
                    entityId: "server-src",
                    isDirectory: true,
                    children: [
                        {
                            name: "services",
                            icon: "folder",
                            entityId: "server-services",
                            isDirectory: true,
                            children: serverRoutes,
                            depth: 2,
                        }
                    ],
                    depth: 1,
                }
            ],
            depth: 0,
        });

        // Config files
        tree.push({
            name: "grapes.config.json",
            icon: "file-text",
            entityId: "root-config",
            isDirectory: false,
            depth: 0,
        });

        tree.push({
            name: "package.json",
            icon: "file-text",
            entityId: "root-pkg",
            isDirectory: false,
            depth: 0,
        });

        return tree;
    };

    if (!project) {
        return (
            <div className="px-6 py-12 text-center animate-fade-in">
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-white/5 flex items-center justify-center text-ide-text-muted/40">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                </div>
                <p className="text-[12px] font-bold text-ide-text-muted uppercase tracking-widest">No Project</p>
                <p className="mt-2 text-[10px] text-ide-text-muted/60 leading-relaxed px-4">
                    Select or create a project to see the file tree structure.
                </p>
            </div>
        );
    }

    return (
        <div className="py-2">
            <div className="space-y-[1px]">
                {getFileTree().map((item) => (
                    <FileTreeItem key={item.entityId} {...item} />
                ))}
            </div>
        </div>
    );
};

export default FileTree;
