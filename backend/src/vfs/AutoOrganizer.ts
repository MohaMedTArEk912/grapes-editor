import { VFSFile, FileType } from './types';
import { FileRegistry } from './FileRegistry';

/**
 * Organization rule definition
 */
interface OrganizationRule {
    when: string;
    condition: (file: VFSFile, context: Record<string, unknown>) => boolean;
    action: (file: VFSFile, context: Record<string, unknown>) => VFSFile;
}

/**
 * Declarative rules for auto-organization
 */
const RULES: OrganizationRule[] = [
    {
        when: 'COMPONENT_CONVERTED',
        condition: (_, ctx) => ctx.convertedFrom === 'section',
        action: (file) => ({
            ...file,
            path: FileRegistry.generatePath(FileType.COMPONENT, file.name),
            type: FileType.COMPONENT,
            protection: FileRegistry.getProtection(FileType.COMPONENT)
        })
    },
    {
        when: 'FILE_CREATED',
        condition: (file) => !file.path || !file.path.startsWith('/'),
        action: (file) => ({
            ...file,
            path: FileRegistry.generatePath(file.type, file.name)
        })
    },
    {
        when: 'FILE_RENAMED',
        condition: () => true,
        action: (file) => ({
            ...file,
            path: FileRegistry.generatePath(file.type, file.name)
        })
    },
    {
        when: 'TYPE_CHANGED',
        condition: () => true,
        action: (file, ctx) => {
            const newType = ctx.newType as FileType;
            return {
                ...file,
                type: newType,
                path: FileRegistry.generatePath(newType, file.name),
                protection: FileRegistry.getProtection(newType)
            };
        }
    }
];

/**
 * Folder node for tree structure
 */
export interface FolderNode {
    name: string;
    path: string;
    children: FolderNode[];
    files: VFSFile[];
}

/**
 * AutoOrganizer - Declarative rules engine for file organization
 * 
 * @description This service automatically organizes files into the correct
 * folders based on their type. Users never need to think about folder structure.
 */
export class AutoOrganizer {
    /**
     * Apply organization rules to file
     */
    static organize(
        file: VFSFile,
        event: string,
        context: Record<string, unknown> = {}
    ): VFSFile {
        let result = { ...file };

        for (const rule of RULES) {
            if (rule.when === event && rule.condition(result, context)) {
                result = rule.action(result, context);
            }
        }

        return result;
    }

    /**
     * Auto-organize entire project
     */
    static organizeProject(files: VFSFile[]): VFSFile[] {
        return files.map(file => this.organize(file, 'FILE_CREATED'));
    }

    /**
     * Derive folder tree from file paths (NOT stored, computed on demand)
     */
    static deriveTree(files: VFSFile[]): FolderNode {
        const root: FolderNode = {
            name: 'project',
            path: '/',
            children: [],
            files: []
        };

        // Only include non-archived files
        const activeFiles = files.filter(f => !f.isArchived);

        for (const file of activeFiles) {
            const parts = file.path.split('/').filter(Boolean);
            let current = root;

            // Navigate/create folder hierarchy
            for (let i = 0; i < parts.length - 1; i++) {
                const folderName = parts[i];
                let folder = current.children.find(c => c.name === folderName);

                if (!folder) {
                    folder = {
                        name: folderName,
                        path: '/' + parts.slice(0, i + 1).join('/'),
                        children: [],
                        files: []
                    };
                    current.children.push(folder);
                }
                current = folder;
            }

            // Add file to its folder
            current.files.push(file);
        }

        // Sort folders and files
        this.sortTree(root);

        return root;
    }

    /**
     * Sort tree nodes alphabetically
     */
    private static sortTree(node: FolderNode): void {
        node.children.sort((a, b) => a.name.localeCompare(b.name));
        node.files.sort((a, b) => a.name.localeCompare(b.name));

        for (const child of node.children) {
            this.sortTree(child);
        }
    }

    /**
     * Get flat list of all folders in project
     */
    static getAllFolders(files: VFSFile[]): string[] {
        const folders = new Set<string>();

        for (const file of files.filter(f => !f.isArchived)) {
            const parts = file.path.split('/').filter(Boolean);
            let path = '';

            for (let i = 0; i < parts.length - 1; i++) {
                path += '/' + parts[i];
                folders.add(path);
            }
        }

        return Array.from(folders).sort();
    }

    /**
     * Check if path would be valid for file type
     */
    static isValidPathForType(path: string, type: FileType): boolean {
        const expectedFolder = FileRegistry.getFolder(type);
        return path.startsWith(expectedFolder + '/');
    }

    /**
     * Suggest correct path for a file
     */
    static suggestPath(file: VFSFile): string {
        return FileRegistry.generatePath(file.type, file.name);
    }

    /**
     * Find misplaced files (in wrong folder for their type)
     */
    static findMisplacedFiles(files: VFSFile[]): VFSFile[] {
        return files.filter(file => {
            if (file.isArchived) return false;
            return !this.isValidPathForType(file.path, file.type);
        });
    }

    /**
     * Auto-fix misplaced files
     */
    static fixMisplacedFiles(files: VFSFile[]): VFSFile[] {
        return files.map(file => {
            if (file.isArchived) return file;
            if (!this.isValidPathForType(file.path, file.type)) {
                return {
                    ...file,
                    path: this.suggestPath(file)
                };
            }
            return file;
        });
    }

    /**
     * Get statistics about file organization
     */
    static getOrganizationStats(files: VFSFile[]): Record<string, number> {
        const stats: Record<string, number> = {
            total: files.length,
            archived: 0,
            misplaced: 0
        };

        // Count by type
        for (const type of Object.values(FileType)) {
            stats[type] = 0;
        }

        for (const file of files) {
            if (file.isArchived) {
                stats.archived++;
            } else {
                stats[file.type] = (stats[file.type] || 0) + 1;
                if (!this.isValidPathForType(file.path, file.type)) {
                    stats.misplaced++;
                }
            }
        }

        return stats;
    }
}
