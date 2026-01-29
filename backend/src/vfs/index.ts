/**
 * VFS Module Index
 * Re-exports all VFS services and types
 */

// Types
export * from './types';

// Services
export { FileRegistry, FileOperationResult } from './FileRegistry';
export { BlockOwnership, BlockTreeNode } from './BlockOwnership';
export { SafetyGuard, ValidationResult, OperationGuardResult } from './SafetyGuard';
export { AutoOrganizer, FolderNode } from './AutoOrganizer';
