import { VFSFile, VFSBlock, VFSVersion } from './types';
import { FileRegistry } from './FileRegistry';
import VFSVersionModel from '../models/VFSVersion';

/**
 * Risky operations that require a snapshot before execution
 */
const RISKY_OPERATIONS = [
    'delete',
    'bulk_delete',
    'move',
    'convert_to_component',
    'merge',
    'refactor',
    'restore_version',
    'bulk_update',
    'archive'
] as const;

type RiskyOperation = typeof RISKY_OPERATIONS[number];

/**
 * Raw CSS patterns that should NOT appear in styles
 * We enforce TailwindCSS-only
 */
const RAW_CSS_PATTERNS = [
    /margin\s*:/i,
    /padding\s*:/i,
    /color\s*:/i,
    /background\s*:/i,
    /font-size\s*:/i,
    /border\s*:/i,
    /display\s*:/i,
    /position\s*:/i,
    /width\s*:/i,
    /height\s*:/i,
    /top\s*:/i,
    /left\s*:/i,
    /right\s*:/i,
    /bottom\s*:/i,
    /flex\s*:/i,
    /grid\s*:/i,
    /z-index\s*:/i,
    /opacity\s*:/i,
    /transform\s*:/i,
    /transition\s*:/i,
];

/**
 * Valid Tailwind class patterns
 */
const TAILWIND_PATTERNS = [
    /^(m|p)(t|r|b|l|x|y)?-\d+$/,  // margin/padding
    /^(text|bg|border)-/,          // colors
    /^(flex|grid|block|inline|hidden)$/,  // display
    /^(w|h|min-w|min-h|max-w|max-h)-/,    // sizing
    /^(rounded|shadow|ring)-?/,    // effects
    /^(font|text|tracking|leading)-/,      // typography
    /^(absolute|relative|fixed|sticky)$/,  // position
    /^(top|left|right|bottom|inset)-/,     // positioning
    /^(z)-/,                        // z-index
    /^(opacity|scale|rotate|translate)-/,  // transforms
    /^(transition|duration|ease|delay)-/,  // transitions
    /^(hover|focus|active|disabled|group-hover):/,  // states
    /^(sm|md|lg|xl|2xl):/,         // responsive
    /^(dark):/,                     // dark mode
];

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

export interface OperationGuardResult {
    allowed: boolean;
    reason?: string;
    requiresSnapshot: boolean;
    snapshotId?: string;
}

/**
 * SafetyGuard - Enforces safety rules before any operation
 * 
 * @description This service prevents accidental data loss and ensures
 * all styles are TailwindCSS-only. It must be called BEFORE any
 * destructive or risky operation.
 */
export class SafetyGuard {
    /**
     * Check if operation is risky (requires snapshot)
     */
    static isRiskyOperation(operation: string): boolean {
        return RISKY_OPERATIONS.includes(operation as RiskyOperation);
    }

    /**
     * Create snapshot before risky operation
     * @param projectId - Project ID
     * @param files - Current files
     * @param blocks - Current blocks
     * @param operation - The risky operation being performed
     * @returns The created version ID
     */
    static async createRiskyOperationSnapshot(
        projectId: string,
        files: VFSFile[],
        blocks: VFSBlock[],
        operation: string
    ): Promise<string> {
        const version = await VFSVersionModel.create({
            projectId,
            label: `Before: ${operation}`,
            snapshot: {
                files: files.map(f => ({ ...f })),
                blocks: blocks.map(b => ({ ...b }))
            },
            trigger: 'before_risky_operation',
            metadata: {
                operation,
                description: `Auto-snapshot before ${operation}`
            }
        });

        return version._id.toString();
    }

    /**
     * Guard an operation - check permissions and create snapshot if needed
     */
    static async guardOperation(
        file: VFSFile,
        operation: string,
        projectId: string,
        allFiles?: VFSFile[],
        allBlocks?: VFSBlock[]
    ): Promise<OperationGuardResult> {
        // Check if operation is allowed
        const validation = FileRegistry.validateOperation(
            file,
            operation as 'delete' | 'rename' | 'rawEdit' | 'uiEdit' | 'move' | 'archive'
        );

        if (!validation.success) {
            return {
                allowed: false,
                reason: validation.error,
                requiresSnapshot: false
            };
        }

        // Check if snapshot is required
        const requiresSnapshot = this.isRiskyOperation(operation);

        if (requiresSnapshot && allFiles && allBlocks) {
            const snapshotId = await this.createRiskyOperationSnapshot(
                projectId,
                allFiles,
                allBlocks,
                operation
            );
            return {
                allowed: true,
                requiresSnapshot: true,
                snapshotId
            };
        }

        return {
            allowed: true,
            requiresSnapshot
        };
    }

    /**
     * Validate that styles are TailwindCSS-only (no raw CSS)
     */
    static validateTailwindStyles(styles: unknown): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!styles || typeof styles !== 'object') {
            return { valid: true, errors, warnings };
        }

        const stringified = JSON.stringify(styles);

        // Check for raw CSS patterns
        for (const pattern of RAW_CSS_PATTERNS) {
            if (pattern.test(stringified)) {
                errors.push(
                    `Raw CSS detected: ${pattern.source}. Use Tailwind classes instead.`
                );
            }
        }

        // Validate Tailwind class format
        const styleObj = styles as Record<string, unknown>;

        const validateClasses = (classes: unknown, path: string) => {
            if (Array.isArray(classes)) {
                for (const cls of classes) {
                    if (typeof cls === 'string' && cls.trim()) {
                        const isValidTailwind = TAILWIND_PATTERNS.some(p => p.test(cls));
                        if (!isValidTailwind && !cls.startsWith('!')) {
                            warnings.push(
                                `Unknown class "${cls}" at ${path}. Ensure it's a valid Tailwind class.`
                            );
                        }
                    }
                }
            }
        };

        if ('base' in styleObj) validateClasses(styleObj.base, 'styles.base');
        if ('hover' in styleObj) validateClasses(styleObj.hover, 'styles.hover');
        if ('focus' in styleObj) validateClasses(styleObj.focus, 'styles.focus');

        if (styleObj.responsive && typeof styleObj.responsive === 'object') {
            const resp = styleObj.responsive as Record<string, unknown>;
            for (const [bp, classes] of Object.entries(resp)) {
                validateClasses(classes, `styles.responsive.${bp}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate a block before saving
     */
    static validateBlock(block: Partial<VFSBlock>): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check required fileId
        if (!block.fileId) {
            errors.push('Block must have an owner file (fileId is required)');
        }

        // Check required type
        if (!block.type) {
            errors.push('Block must have a type');
        }

        // Validate styles
        if (block.styles) {
            const styleValidation = this.validateTailwindStyles(block.styles);
            errors.push(...styleValidation.errors);
            warnings.push(...styleValidation.warnings);
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Archive a file instead of deleting (for protected files)
     */
    static archiveFile(file: VFSFile): VFSFile {
        return {
            ...file,
            isArchived: true,
            archivedAt: new Date()
        };
    }

    /**
     * Restore an archived file
     */
    static restoreFile(file: VFSFile): VFSFile {
        return {
            ...file,
            isArchived: false,
            archivedAt: undefined
        };
    }

    /**
     * Validate entire project state
     */
    static validateProjectState(
        files: VFSFile[],
        blocks: VFSBlock[]
    ): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check for orphan blocks
        const fileIds = new Set(files.map(f => f.id));
        for (const block of blocks) {
            if (!fileIds.has(block.fileId)) {
                errors.push(`Orphan block detected: ${block.id} (fileId: ${block.fileId})`);
            }
        }

        // Check for duplicate paths
        const pathCounts = new Map<string, number>();
        for (const file of files.filter(f => !f.isArchived)) {
            const count = pathCounts.get(file.path) || 0;
            pathCounts.set(file.path, count + 1);
        }
        for (const [path, count] of pathCounts) {
            if (count > 1) {
                errors.push(`Duplicate file path: ${path} (${count} files)`);
            }
        }

        // Validate all block styles
        for (const block of blocks) {
            const styleValidation = this.validateTailwindStyles(block.styles);
            if (!styleValidation.valid) {
                errors.push(`Block ${block.id}: ${styleValidation.errors.join(', ')}`);
            }
            warnings.push(...styleValidation.warnings.map(w => `Block ${block.id}: ${w}`));
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Get allowed operations for a file (used by UI)
     */
    static getFileCapabilities(file: VFSFile): Record<string, boolean | string> {
        const ops = FileRegistry.getAllowedOperations(file);

        return {
            ...ops,
            protectionLevel: file.protection,
            hint: file.protection === 'protected'
                ? 'This file is managed by the editor. Use archive instead of delete.'
                : file.protection === 'semi_editable'
                    ? 'This file can be edited via forms but not raw code.'
                    : 'This file can be freely edited.'
        };
    }
}
