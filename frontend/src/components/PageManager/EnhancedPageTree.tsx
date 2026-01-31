import React, { useState, useCallback } from 'react';
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Plus,
  Copy,
  Trash2,
  Home,
  MoreVertical,
  GripVertical,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Page } from '../../services/pageService';

interface PageNode {
  page: Page;
  children: PageNode[];
  level: number;
}

interface EnhancedPageTreeProps {
  pages: Page[];
  currentPageId?: string;
  onPageSelect: (page: Page) => void;
  onPageCreate?: (parentId?: string) => void;
  onPageDuplicate?: (page: Page) => void;
  onPageDelete?: (page: Page) => void;
  onPageReorder?: (draggedId: string, targetId: string, position: 'before' | 'after' | 'child') => void;
}

export const EnhancedPageTree: React.FC<EnhancedPageTreeProps> = ({
  pages,
  currentPageId,
  onPageSelect,
  onPageCreate,
  onPageDuplicate,
  onPageDelete,
  onPageReorder,
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: 'before' | 'after' | 'child' } | null>(null);

  // Build tree structure (for future parent-child relationships)
  const buildTree = useCallback((): PageNode[] => {
    // For now, flat structure; can be extended for hierarchical pages
    return pages.map(page => ({
      page,
      children: [],
      level: 0,
    }));
  }, [pages]);

  const tree = buildTree();

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDragStart = (e: React.DragEvent, pageId: string) => {
    setDraggedId(pageId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, pageId: string) => {
    e.preventDefault();
    if (draggedId === pageId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    let position: 'before' | 'after' | 'child' = 'before';
    if (y < height * 0.33) {
      position = 'before';
    } else if (y > height * 0.66) {
      position = 'after';
    } else {
      position = 'child';
    }

    setDropTarget({ id: pageId, position });
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedId && dropTarget && onPageReorder) {
      onPageReorder(draggedId, targetId, dropTarget.position);
    }
    setDraggedId(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDropTarget(null);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-white">Pages</h3>
        <button
          onClick={() => onPageCreate?.()}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          title="Add Page"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto">
        {tree.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500 text-sm">
            <FileText className="w-8 h-8 mb-2 opacity-50" />
            <p>No pages yet</p>
          </div>
        ) : (
          <div className="py-1">
            {tree.map((node) => (
              <PageTreeNode
                key={node.page._id}
                node={node}
                isActive={currentPageId === node.page._id}
                isExpanded={expandedIds.has(node.page._id)}
                isDragged={draggedId === node.page._id}
                dropTarget={dropTarget?.id === node.page._id ? dropTarget.position : null}
                onToggleExpand={() => toggleExpanded(node.page._id)}
                onSelect={() => onPageSelect(node.page)}
                onDuplicate={() => onPageDuplicate?.(node.page)}
                onDelete={() => onPageDelete?.(node.page)}
                onDragStart={(e) => handleDragStart(e, node.page._id)}
                onDragOver={(e) => handleDragOver(e, node.page._id)}
                onDrop={(e) => handleDrop(e, node.page._id)}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Page Tree Node Component
const PageTreeNode: React.FC<{
  node: PageNode;
  isActive: boolean;
  isExpanded: boolean;
  isDragged: boolean;
  dropTarget: 'before' | 'after' | 'child' | null;
  onToggleExpand: () => void;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}> = ({
  node,
  isActive,
  isExpanded,
  isDragged,
  dropTarget,
  onToggleExpand,
  onSelect,
  onDuplicate,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}) => {
  const [showActions, setShowActions] = useState(false);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      {/* Drop Indicator - Before */}
      {dropTarget === 'before' && (
        <div className="h-0.5 bg-blue-500 mx-2"></div>
      )}

      {/* Node */}
      <div
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        className={`
          group flex items-center gap-1 px-2 py-1.5 mx-1 rounded cursor-pointer
          transition-colors
          ${isDragged ? 'opacity-50' : ''}
          ${dropTarget === 'child' ? 'bg-blue-500/20 border-l-2 border-blue-500' : ''}
          ${
            isActive
              ? 'bg-blue-600 text-white'
              : 'text-gray-300 hover:bg-gray-800'
          }
        `}
        style={{ paddingLeft: `${(node.level + 1) * 0.75}rem` }}
      >
        {/* Drag Handle */}
        <div className="text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        {/* Expand/Collapse */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="text-gray-400 hover:text-white transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        ) : (
          <div className="w-4"></div>
        )}

        {/* Icon */}
        <div className={isActive ? 'text-white' : 'text-gray-500'}>
          {node.page.slug === '/' || node.page.slug === 'index' ? (
            <Home className="w-4 h-4" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
        </div>

        {/* Name */}
        <div
          onClick={onSelect}
          className="flex-1 text-sm truncate"
        >
          {node.page.name}
        </div>

        {/* Visibility */}
        {/* Uncomment and update the following if 'isPublished' is added to Page type in the future
        {node.page.isPublished === false && (
          <span title="Unpublished">
            <EyeOff className="w-3.5 h-3.5 text-gray-500" />
          </span>
        )}
        */}

        {/* Actions */}
        {showActions && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
              className={`p-1 rounded transition-colors ${
                isActive
                  ? 'hover:bg-blue-700'
                  : 'hover:bg-gray-700'
              }`}
              title="Duplicate"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className={`p-1 rounded transition-colors ${
                isActive
                  ? 'hover:bg-red-700'
                  : 'hover:bg-red-900/50 text-red-400'
              }`}
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Drop Indicator - After */}
      {dropTarget === 'after' && (
        <div className="h-0.5 bg-blue-500 mx-2"></div>
      )}

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <PageTreeNode
              key={child.page._id}
              node={child}
              isActive={false}
              isExpanded={false}
              isDragged={false}
              dropTarget={null}
              onToggleExpand={() => {}}
              onSelect={onSelect}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  );
};
