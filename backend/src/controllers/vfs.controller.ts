import { Request, Response } from 'express';
import VFSFileModel from '../models/VFSFile';
import VFSBlockModel from '../models/VFSBlock';
import VFSVersionModel from '../models/VFSVersion';
import { FileRegistry, SafetyGuard, AutoOrganizer, BlockOwnership } from '../vfs';
import { FileType, ProtectionLevel } from '../vfs/types';
import { undoStack, UndoAction } from '../vfs/UndoStack';
import mongoose from 'mongoose';

const toPlain = (doc: any) => {
    if (!doc) return doc;
    return typeof doc.toObject === 'function' ? doc.toObject() : doc;
};

const normalizeId = (doc: any) => (doc?._id || doc?.id || doc);

const sanitizeDoc = (doc: any) => {
    if (!doc) return doc;
    const clean = { ...doc } as any;
    delete clean.__v;
    return clean;
};

const upsertFile = async (file: any) => {
    if (!file) return;
    const id = normalizeId(file);
    const update = sanitizeDoc({ ...file });
    delete update._id;
    await VFSFileModel.findByIdAndUpdate(id, update, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
    });
};

const upsertBlock = async (block: any) => {
    if (!block) return;
    const id = normalizeId(block);
    const update = sanitizeDoc({ ...block });
    delete update._id;
    await VFSBlockModel.findByIdAndUpdate(id, update, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
    });
};

const upsertBlocks = async (blocks: any[]) => {
    if (!blocks || blocks.length === 0) return;
    const ops = blocks.map((block) => {
        const id = normalizeId(block);
        const update = sanitizeDoc({ ...block });
        delete update._id;
        return {
            updateOne: {
                filter: { _id: id },
                update: { $set: update },
                upsert: true,
            },
        };
    });
    await VFSBlockModel.bulkWrite(ops);
};

const applyUndoAction = async (action: UndoAction, direction: 'undo' | 'redo') => {
    const payload = direction === 'undo' ? action.before : action.after;

    switch (action.type) {
        case 'file_create':
            if (direction === 'undo') {
                const id = normalizeId(action.after?.file || action.fileId);
                if (id) {
                    await VFSFileModel.findByIdAndDelete(id);
                }
            } else {
                await upsertFile(action.after?.file);
            }
            break;
        case 'file_update':
        case 'file_archive':
        case 'file_restore':
            await upsertFile(payload.file);
            break;
        case 'block_create':
            if (direction === 'undo') {
                const id = normalizeId(action.after?.block);
                if (id) {
                    await VFSBlockModel.findByIdAndDelete(id);
                }
            } else {
                await upsertBlock(action.after?.block);
            }
            break;
        case 'block_delete':
            if (direction === 'undo') {
                await upsertBlock(action.before?.block);
            } else {
                const id = normalizeId(action.before?.block || action.after?.block);
                if (id) {
                    await VFSBlockModel.findByIdAndDelete(id);
                }
            }
            break;
        case 'block_update':
        case 'style_change':
            await upsertBlock(payload.block);
            break;
        case 'block_reorder':
        case 'block_move':
        case 'batch':
            await upsertBlocks(payload.blocks || []);
            break;
        default:
            break;
    }
};

const buildSnapshotDiff = (baseFiles: any[], targetFiles: any[], baseBlocks: any[], targetBlocks: any[]) => {
    const fileKey = (file: any) => file?.path || normalizeId(file);
    const filePick = (file: any) => ({
        name: file?.name,
        path: file?.path,
        type: file?.type,
        protection: file?.protection,
        isArchived: file?.isArchived,
        schema: file?.schema || file?.dataSchema,
    });
    const blockPick = (block: any) => ({
        type: block?.type,
        props: block?.props,
        styles: block?.styles,
        events: block?.events,
        order: block?.order,
        parentBlockId: block?.parentBlockId,
    });

    const baseFileMap = new Map(baseFiles.map((file) => [fileKey(file), file]));
    const targetFileMap = new Map(targetFiles.map((file) => [fileKey(file), file]));

    const addedFiles = Array.from(targetFileMap.entries())
        .filter(([key]) => !baseFileMap.has(key))
        .map(([, file]) => filePick(file));
    const removedFiles = Array.from(baseFileMap.entries())
        .filter(([key]) => !targetFileMap.has(key))
        .map(([, file]) => filePick(file));
    const changedFiles = Array.from(targetFileMap.entries())
        .filter(([key]) => baseFileMap.has(key))
        .map(([key, file]) => {
            const base = baseFileMap.get(key);
            const before = JSON.stringify(filePick(base));
            const after = JSON.stringify(filePick(file));
            if (before === after) return null;
            return {
                path: file?.path,
                name: file?.name,
                type: file?.type,
            };
        })
        .filter(Boolean);

    const blockKey = (block: any) => normalizeId(block);
    const baseBlockMap = new Map(baseBlocks.map((block) => [blockKey(block), block]));
    const targetBlockMap = new Map(targetBlocks.map((block) => [blockKey(block), block]));

    const addedBlocks = Array.from(targetBlockMap.entries())
        .filter(([key]) => !baseBlockMap.has(key))
        .map(([, block]) => ({ id: normalizeId(block), type: block?.type }));
    const removedBlocks = Array.from(baseBlockMap.entries())
        .filter(([key]) => !targetBlockMap.has(key))
        .map(([, block]) => ({ id: normalizeId(block), type: block?.type }));
    const changedBlocks = Array.from(targetBlockMap.entries())
        .filter(([key]) => baseBlockMap.has(key))
        .map(([key, block]) => {
            const base = baseBlockMap.get(key);
            const before = JSON.stringify(blockPick(base));
            const after = JSON.stringify(blockPick(block));
            if (before === after) return null;
            return { id: normalizeId(block), type: block?.type };
        })
        .filter(Boolean);

    return {
        files: {
            added: addedFiles,
            removed: removedFiles,
            changed: changedFiles,
        },
        blocks: {
            added: addedBlocks,
            removed: removedBlocks,
            changed: changedBlocks,
        },
    };
};

/**
 * VFS Controller - Handles all virtual file system operations
 * Note: @ts-ignore comments used for Mongoose 9 typing issues
 */

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Get all files for a project (tree structure)
 */
export const getProjectFiles = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const includeArchived = req.query.includeArchived === 'true';

        const query: Record<string, unknown> = { projectId };
        if (!includeArchived) {
            query.isArchived = false;
        }

        // @ts-ignore - Mongoose typing
        const files = await VFSFileModel.find(query).sort({ path: 1 }).lean();

        // @ts-ignore - Derive tree structure
        const tree = AutoOrganizer.deriveTree(files as any);

        // @ts-ignore
        const stats = AutoOrganizer.getOrganizationStats(files as any);

        res.json({
            success: true,
            data: { files, tree, stats }
        });
    } catch (error) {
        console.error('Error fetching project files:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch project files'
        });
    }
};

/**
 * Get single file by ID
 */
export const getFile = async (req: Request, res: Response) => {
    try {
        const { fileId } = req.params;

        // @ts-ignore
        const file = await VFSFileModel.findById(fileId).lean();
        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        // @ts-ignore - Get file capabilities
        const capabilities = SafetyGuard.getFileCapabilities(file as any);

        res.json({
            success: true,
            data: { file, capabilities }
        });
    } catch (error) {
        console.error('Error fetching file:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch file'
        });
    }
};

/**
 * Create new file
 */
export const createFile = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { name, type, schema } = req.body;

        if (!name || !type) {
            return res.status(400).json({
                success: false,
                error: 'Name and type are required'
            });
        }

        // Validate file type
        if (!Object.values(FileType).includes(type)) {
            return res.status(400).json({
                success: false,
                error: `Invalid file type: ${type}`
            });
        }

        // Create file with auto-organization
        const fileData = FileRegistry.createFile(projectId as string, name, type, schema || {});

        const file = await VFSFileModel.create({
            ...fileData,
            projectId
        });

        undoStack.recordFileCreate(file._id.toString(), toPlain(file) as any);

        res.status(201).json({
            success: true,
            data: { file }
        });
    } catch (error: any) {
        console.error('Error creating file:', error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                error: 'A file with this path already exists'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to create file'
        });
    }
};

/**
 * Update file
 */
export const updateFile = async (req: Request, res: Response) => {
    try {
        const { fileId } = req.params;
        const updates = req.body;

        // @ts-ignore
        const file = await VFSFileModel.findById(fileId);
        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        // Check permissions
        if (updates.name && file.protection === ProtectionLevel.PROTECTED) {
            return res.status(403).json({
                success: false,
                error: 'Cannot rename protected files'
            });
        }

        const before = toPlain(file);

        // Apply updates
        if (updates.name) {
            file.name = updates.name;
            file.path = FileRegistry.generatePath(file.type as FileType, updates.name);
        }
        if (updates.schema !== undefined) {
            file.dataSchema = updates.schema;
        }

        await file.save();

        undoStack.recordFileUpdate(file._id.toString(), before as any, toPlain(file) as any, 'Updated file');

        res.json({
            success: true,
            data: { file }
        });
    } catch (error) {
        console.error('Error updating file:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update file'
        });
    }
};

/**
 * Move file to new path (validated)
 */
export const moveFile = async (req: Request, res: Response) => {
    try {
        const { fileId } = req.params;
        const { path } = req.body as { path?: string };

        if (!path || typeof path !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Target path is required'
            });
        }

        // @ts-ignore
        const file = await VFSFileModel.findById(fileId);
        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        // Load project files/blocks for guard + snapshot
        // @ts-ignore
        const allFiles = await VFSFileModel.find({ projectId: file.projectId }).lean();
        // @ts-ignore
        const allBlocks = await VFSBlockModel.find({ projectId: file.projectId }).lean();

        // @ts-ignore
        const guard = await SafetyGuard.guardOperation(
            file.toObject() as any,
            'move',
            file.projectId.toString(),
            allFiles as any,
            allBlocks as any
        );

        if (!guard.allowed) {
            return res.status(403).json({
                success: false,
                error: guard.reason || 'Move not allowed'
            });
        }

        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        const extension = FileRegistry.getExtension(file.type as FileType);

        if (!normalizedPath.endsWith(`.${extension}`)) {
            return res.status(400).json({
                success: false,
                error: `Invalid path extension. Expected .${extension}`
            });
        }

        if (!AutoOrganizer.isValidPathForType(normalizedPath, file.type as FileType)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid path for file type',
                hint: `Suggested path: ${AutoOrganizer.suggestPath(file.toObject() as any)}`
            });
        }

        // Check for existing file conflict
        // @ts-ignore
        const conflict = await VFSFileModel.findOne({
            projectId: file.projectId,
            path: normalizedPath,
            _id: { $ne: file._id },
            isArchived: false
        });

        if (conflict) {
            return res.status(409).json({
                success: false,
                error: 'A file with this path already exists'
            });
        }

        const before = toPlain(file);
        const parsed = FileRegistry.parsePath(normalizedPath);
        file.path = normalizedPath;
        file.name = parsed.name;

        await file.save();

        undoStack.recordFileUpdate(file._id.toString(), before as any, toPlain(file) as any, 'Moved file');

        res.json({
            success: true,
            data: { file }
        });
    } catch (error) {
        console.error('Error moving file:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to move file'
        });
    }
};

/**
 * Delete file (only for free_code files)
 */
export const deleteFile = async (req: Request, res: Response) => {
    try {
        const { fileId } = req.params;

        // @ts-ignore
        const file = await VFSFileModel.findById(fileId);
        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        // Check if delete is allowed
        // @ts-ignore
        const validation = FileRegistry.validateOperation(file.toObject() as any, 'delete');
        if (!validation.success) {
            return res.status(403).json({
                success: false,
                error: validation.error,
                hint: 'Use archive instead of delete for this file type'
            });
        }

        // Delete file and its blocks
        // @ts-ignore
        await VFSBlockModel.deleteMany({ fileId });
        await file.deleteOne();

        res.json({
            success: true,
            message: 'File deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete file'
        });
    }
};

/**
 * Archive file (safe delete for protected files)
 */
export const archiveFile = async (req: Request, res: Response) => {
    try {
        const { fileId } = req.params;

        // @ts-ignore
        const file = await VFSFileModel.findById(fileId);
        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        // Get all files and blocks for snapshot
        // @ts-ignore
        const allFiles = await VFSFileModel.find({ projectId: file.projectId }).lean();
        // @ts-ignore
        const allBlocks = await VFSBlockModel.find({ projectId: file.projectId }).lean();

        // Create snapshot before archive
        await SafetyGuard.createRiskyOperationSnapshot(
            file.projectId.toString(),
            allFiles as any,
            allBlocks as any,
            'archive'
        );

        const before = toPlain(file);

        // Archive the file
        file.isArchived = true;
        file.archivedAt = new Date();
        await file.save();

        undoStack.recordFileArchive(file._id.toString(), before as any, toPlain(file) as any);

        res.json({
            success: true,
            message: 'File archived successfully',
            data: { file }
        });
    } catch (error) {
        console.error('Error archiving file:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to archive file'
        });
    }
};

/**
 * Restore archived file
 */
export const restoreFile = async (req: Request, res: Response) => {
    try {
        const { fileId } = req.params;

        // @ts-ignore
        const file = await VFSFileModel.findById(fileId);
        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        if (!file.isArchived) {
            return res.status(400).json({
                success: false,
                error: 'File is not archived'
            });
        }

        const before = toPlain(file);

        file.isArchived = false;
        file.archivedAt = undefined;
        await file.save();

        undoStack.recordFileRestore(file._id.toString(), before as any, toPlain(file) as any);

        res.json({
            success: true,
            message: 'File restored successfully',
            data: { file }
        });
    } catch (error) {
        console.error('Error restoring file:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to restore file'
        });
    }
};

// ============================================================================
// BLOCK OPERATIONS
// ============================================================================

/**
 * Get blocks for a file
 */
export const getFileBlocks = async (req: Request, res: Response) => {
    try {
        const { fileId } = req.params;

        // @ts-ignore
        const blocks = await VFSBlockModel.find({ fileId }).sort({ order: 1 }).lean();

        // @ts-ignore - Build tree structure
        const tree = BlockOwnership.buildBlockTree(fileId, blocks as any);

        res.json({
            success: true,
            data: { blocks, tree }
        });
    } catch (error) {
        console.error('Error fetching file blocks:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch blocks'
        });
    }
};

/**
 * Create block
 */
export const createBlock = async (req: Request, res: Response) => {
    try {
        const { fileId } = req.params;
        const { type, props, styles, parentBlockId } = req.body;

        if (!type) {
            return res.status(400).json({
                success: false,
                error: 'Block type is required'
            });
        }

        // Validate styles are Tailwind-only
        if (styles) {
            const validation = SafetyGuard.validateTailwindStyles(styles);
            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid styles - must use Tailwind classes only',
                    details: validation.errors
                });
            }
        }

        // Get file to extract projectId
        // @ts-ignore
        const file = await VFSFileModel.findById(fileId);
        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'Owner file not found'
            });
        }

        // Get max order for positioning
        // @ts-ignore
        const lastBlock = await VFSBlockModel.findOne({ fileId, parentBlockId })
            .sort({ order: -1 });
        const order = lastBlock ? lastBlock.order + 1 : 0;

        const block = await VFSBlockModel.create({
            fileId,
            projectId: file.projectId,
            type,
            props: props || {},
            styles: styles || { base: [] },
            order,
            parentBlockId
        });

        undoStack.recordBlockCreate(fileId, toPlain(block) as any);

        res.status(201).json({
            success: true,
            data: { block }
        });
    } catch (error: any) {
        console.error('Error creating block:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create block'
        });
    }
};

/**
 * Update block
 */
export const updateBlock = async (req: Request, res: Response) => {
    try {
        const { blockId } = req.params;
        const updates = req.body;

        // @ts-ignore
        const block = await VFSBlockModel.findById(blockId);
        if (!block) {
            return res.status(404).json({
                success: false,
                error: 'Block not found'
            });
        }

        // Check constraints
        if (block.constraints && !block.constraints.canEdit) {
            return res.status(403).json({
                success: false,
                error: 'This block cannot be edited'
            });
        }

        // Validate styles
        if (updates.styles) {
            const validation = SafetyGuard.validateTailwindStyles(updates.styles);
            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid styles - must use Tailwind classes only',
                    details: validation.errors
                });
            }
        }

        // Check locked props
        if (updates.props && block.constraints?.lockedProps?.length > 0) {
            for (const lockedProp of block.constraints.lockedProps) {
                if (lockedProp in updates.props) {
                    return res.status(403).json({
                        success: false,
                        error: `Property '${lockedProp}' is locked and cannot be modified`
                    });
                }
            }
        }

        const before = toPlain(block);

        // Apply updates
        if (updates.props) block.props = { ...block.props, ...updates.props };
        if (updates.styles) block.styles = updates.styles;
        if (updates.events) block.events = updates.events;
        if (updates.order !== undefined) block.order = updates.order;
        if (updates.parentBlockId !== undefined) block.parentBlockId = updates.parentBlockId;

        await block.save();

        undoStack.recordBlockUpdate(block.fileId.toString(), before as any, toPlain(block) as any);

        res.json({
            success: true,
            data: { block }
        });
    } catch (error) {
        console.error('Error updating block:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update block'
        });
    }
};

/**
 * Delete block
 */
export const deleteBlock = async (req: Request, res: Response) => {
    try {
        const { blockId } = req.params;

        // @ts-ignore
        const block = await VFSBlockModel.findById(blockId);
        if (!block) {
            return res.status(404).json({
                success: false,
                error: 'Block not found'
            });
        }

        // Check constraints
        if (block.constraints && !block.constraints.canDelete) {
            return res.status(403).json({
                success: false,
                error: 'This block cannot be deleted'
            });
        }

        const before = toPlain(block);

        // Delete children first
        // @ts-ignore
        await VFSBlockModel.deleteMany({ parentBlockId: blockId });
        await block.deleteOne();

        undoStack.recordBlockDelete(block.fileId.toString(), before as any);

        res.json({
            success: true,
            message: 'Block deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting block:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete block'
        });
    }
};

/**
 * Reorder blocks within file
 */
export const reorderBlocks = async (req: Request, res: Response) => {
    try {
        const { fileId } = req.params;
        const { order } = req.body;

        if (!Array.isArray(order)) {
            return res.status(400).json({
                success: false,
                error: 'Order must be an array of block IDs'
            });
        }

        // @ts-ignore
        const blocksBefore = await VFSBlockModel.find({ fileId }).lean();

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            for (let i = 0; i < order.length; i++) {
                await VFSBlockModel.findByIdAndUpdate(
                    order[i],
                    { order: i },
                    { session }
                );
            }
            await session.commitTransaction();
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }

        // @ts-ignore
        const blocksAfter = await VFSBlockModel.find({ fileId }).lean();
        undoStack.recordBlockReorder(fileId, blocksBefore as any, blocksAfter as any);

        res.json({
            success: true,
            message: 'Blocks reordered successfully'
        });
    } catch (error) {
        console.error('Error reordering blocks:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reorder blocks'
        });
    }
};

// ============================================================================
// VERSION OPERATIONS
// ============================================================================

/**
 * Get versions for project
 */
export const getVersions = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const limit = parseInt(req.query.limit as string) || 20;

        // @ts-ignore
        const versions = await VFSVersionModel.find({ projectId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .select('-snapshot')
            .lean();

        res.json({
            success: true,
            data: { versions }
        });
    } catch (error) {
        console.error('Error fetching versions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch versions'
        });
    }
};

/**
 * Create manual version (named snapshot)
 */
export const createVersion = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { label } = req.body;

        // @ts-ignore
        const files = await VFSFileModel.find({ projectId }).lean();
        // @ts-ignore
        const blocks = await VFSBlockModel.find({ projectId }).lean();

        const version = await VFSVersionModel.create({
            projectId,
            label: label || `Version ${new Date().toISOString()}`,
            snapshot: {
                files: files as any[],
                blocks: blocks as any[]
            },
            trigger: 'manual'
        });

        res.status(201).json({
            success: true,
            data: {
                version: {
                    _id: version._id,
                    label: version.label,
                    trigger: version.trigger,
                    createdAt: version.createdAt
                }
            }
        });
    } catch (error) {
        console.error('Error creating version:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create version'
        });
    }
};

/**
 * Restore version
 */
export const restoreVersion = async (req: Request, res: Response) => {
    try {
        const { versionId } = req.params;

        // @ts-ignore
        const version = await VFSVersionModel.findById(versionId);
        if (!version) {
            return res.status(404).json({
                success: false,
                error: 'Version not found'
            });
        }

        const projectId = version.projectId;

        // Create backup snapshot before restore
        // @ts-ignore
        const currentFiles = await VFSFileModel.find({ projectId }).lean();
        // @ts-ignore
        const currentBlocks = await VFSBlockModel.find({ projectId }).lean();

        await SafetyGuard.createRiskyOperationSnapshot(
            projectId.toString(),
            currentFiles as any,
            currentBlocks as any,
            'restore_version'
        );

        // Clear current state
        // @ts-ignore
        await VFSFileModel.deleteMany({ projectId });
        // @ts-ignore
        await VFSBlockModel.deleteMany({ projectId });

        // Restore from snapshot
        if (version.snapshot.files.length > 0) {
            await VFSFileModel.insertMany(version.snapshot.files);
        }
        if (version.snapshot.blocks.length > 0) {
            await VFSBlockModel.insertMany(version.snapshot.blocks);
        }

        res.json({
            success: true,
            message: 'Version restored successfully'
        });
    } catch (error) {
        console.error('Error restoring version:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to restore version'
        });
    }
};

// ============================================================================
// UNDO OPERATIONS
// ============================================================================

export const getUndoHistory = async (req: Request, res: Response) => {
    try {
        const { fileId } = req.params;
        const limit = parseInt(req.query.limit as string) || 20;
        const history = undoStack.getHistory(fileId, limit);
        const stats = undoStack.getStats(fileId);

        res.json({
            success: true,
            data: { history, stats }
        });
    } catch (error) {
        console.error('Error fetching undo history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch undo history'
        });
    }
};

export const undoFileAction = async (req: Request, res: Response) => {
    try {
        const { fileId } = req.params;
        const action = undoStack.popUndo(fileId);

        if (!action) {
            return res.status(400).json({
                success: false,
                error: 'Nothing to undo'
            });
        }

        await applyUndoAction(action, 'undo');
        const stats = undoStack.getStats(fileId);

        res.json({
            success: true,
            data: { action, stats }
        });
    } catch (error) {
        console.error('Error undoing action:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to undo action'
        });
    }
};

export const redoFileAction = async (req: Request, res: Response) => {
    try {
        const { fileId } = req.params;
        const action = undoStack.popRedo(fileId);

        if (!action) {
            return res.status(400).json({
                success: false,
                error: 'Nothing to redo'
            });
        }

        await applyUndoAction(action, 'redo');
        const stats = undoStack.getStats(fileId);

        res.json({
            success: true,
            data: { action, stats }
        });
    } catch (error) {
        console.error('Error redoing action:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to redo action'
        });
    }
};

// ============================================================================
// VERSION DIFF
// ============================================================================

export const getVersionDiff = async (req: Request, res: Response) => {
    try {
        const { versionId } = req.params;
        const compareTarget = (req.query.with as string) || 'current';

        // @ts-ignore
        const version = await VFSVersionModel.findById(versionId).lean();
        if (!version) {
            return res.status(404).json({
                success: false,
                error: 'Version not found'
            });
        }

        let targetFiles: any[] = [];
        let targetBlocks: any[] = [];

        if (compareTarget === 'current') {
            // @ts-ignore
            targetFiles = await VFSFileModel.find({ projectId: version.projectId }).lean();
            // @ts-ignore
            targetBlocks = await VFSBlockModel.find({ projectId: version.projectId }).lean();
        } else {
            // @ts-ignore
            const compareVersion = await VFSVersionModel.findById(compareTarget).lean();
            if (!compareVersion) {
                return res.status(404).json({
                    success: false,
                    error: 'Compare version not found'
                });
            }
            targetFiles = compareVersion.snapshot?.files || [];
            targetBlocks = compareVersion.snapshot?.blocks || [];
        }

        const diff = buildSnapshotDiff(
            version.snapshot?.files || [],
            targetFiles,
            version.snapshot?.blocks || [],
            targetBlocks
        );

        res.json({
            success: true,
            data: { diff }
        });
    } catch (error) {
        console.error('Error generating version diff:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate version diff'
        });
    }
};
