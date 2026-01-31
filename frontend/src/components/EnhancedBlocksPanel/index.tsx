import React, { useState, useMemo } from 'react';
import { Search, Star, Clock, Grid3x3, List, Plus } from 'lucide-react';
import { FixedSizeGrid, FixedSizeList, GridChildComponentProps, ListChildComponentProps } from 'react-window';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useElementSize } from '../../hooks/useElementSize';

interface BlockCategory {
  id: string;
  label: string;
  icon?: string;
}

interface Block {
  id: string;
  label: string;
  category: string;
  media?: string;
  isFavorite?: boolean;
  lastUsed?: Date;
}

interface EnhancedBlocksPanelProps {
  blocks: Block[];
  onBlockAdd: (block: Block) => void;
  onToggleFavorite?: (blockId: string) => void;
  categories?: BlockCategory[];
}

export const EnhancedBlocksPanel: React.FC<EnhancedBlocksPanelProps> = ({
  blocks,
  onBlockAdd,
  onToggleFavorite,
  categories = [],
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery, 200);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<'all' | 'favorites' | 'recent'>('all');
  const { ref: listRef, size } = useElementSize<HTMLDivElement>();

  // Derive categories from blocks if not provided
  const derivedCategories = useMemo(() => {
    if (categories.length > 0) return categories;
    const cats = new Set(blocks.map(b => b.category));
    return Array.from(cats).map(cat => ({ id: cat, label: cat }));
  }, [blocks, categories]);

  // Filter blocks
  const filteredBlocks = useMemo(() => {
    let filtered = blocks;

    // Filter by tab
    if (activeTab === 'favorites') {
      filtered = filtered.filter(b => b.isFavorite);
    } else if (activeTab === 'recent') {
      filtered = filtered
        .filter(b => b.lastUsed)
        .sort((a, b) => (b.lastUsed?.getTime() || 0) - (a.lastUsed?.getTime() || 0))
        .slice(0, 10);
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(b => b.category === selectedCategory);
    }

    // Filter by search
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      filtered = filtered.filter(b =>
        b.label.toLowerCase().includes(query) ||
        b.category.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [blocks, activeTab, selectedCategory, debouncedSearch]);

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Search Bar */}
      <div className="p-3 border-b border-gray-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search blocks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === 'all'
              ? 'text-white bg-gray-800 border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setActiveTab('favorites')}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
            activeTab === 'favorites'
              ? 'text-white bg-gray-800 border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Star className="w-3.5 h-3.5" />
          Favorites
        </button>
        <button
          onClick={() => setActiveTab('recent')}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
            activeTab === 'recent'
              ? 'text-white bg-gray-800 border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Recent
        </button>
      </div>

      {/* Categories & View Toggle */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-1.5 bg-gray-800 text-sm text-white rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Categories</option>
          {derivedCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded ${
              viewMode === 'grid'
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
            aria-label="Grid view"
          >
            <Grid3x3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded ${
              viewMode === 'list'
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
            aria-label="List view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Blocks List */}
      <div className="flex-1 overflow-hidden p-3" ref={listRef}>
        {filteredBlocks.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No blocks found</p>
          </div>
        ) : viewMode === 'grid' ? (
          size.height > 0 && size.width > 0 ? (
            <FixedSizeGrid
              columnCount={size.width >= 320 ? 2 : 1}
              columnWidth={size.width >= 320 ? Math.floor((size.width - 8) / 2) : size.width}
              height={size.height}
              rowCount={Math.ceil(filteredBlocks.length / (size.width >= 320 ? 2 : 1))}
              rowHeight={180}
              width={size.width}
            >
              {({ columnIndex, rowIndex, style }: GridChildComponentProps) => {
                const columns = size.width >= 320 ? 2 : 1;
                const index = rowIndex * columns + columnIndex;
                const block = filteredBlocks[index];
                if (!block) return null;
                return (
                  <div style={{ ...style, padding: 4 }}>
                    <BlockCard
                      block={block}
                      onAdd={() => onBlockAdd(block)}
                      onToggleFavorite={onToggleFavorite}
                    />
                  </div>
                );
              }}
            </FixedSizeGrid>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filteredBlocks.map((block) => (
                <BlockCard
                  key={block.id}
                  block={block}
                  onAdd={() => onBlockAdd(block)}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </div>
          )
        ) : (
          size.height > 0 && size.width > 0 ? (
            <FixedSizeList
              height={size.height}
              itemCount={filteredBlocks.length}
              itemSize={68}
              width={size.width}
            >
              {({ index, style }: ListChildComponentProps) => {
                const block = filteredBlocks[index];
                return (
                  <div style={{ ...style, paddingBottom: 4 }}>
                    <BlockListItem
                      block={block}
                      onAdd={() => onBlockAdd(block)}
                      onToggleFavorite={onToggleFavorite}
                    />
                  </div>
                );
              }}
            </FixedSizeList>
          ) : (
            <div className="space-y-1">
              {filteredBlocks.map((block) => (
                <BlockListItem
                  key={block.id}
                  block={block}
                  onAdd={() => onBlockAdd(block)}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};

// Block Card Component (Grid View)
const BlockCard: React.FC<{
  block: Block;
  onAdd: () => void;
  onToggleFavorite?: (id: string) => void;
}> = ({ block, onAdd, onToggleFavorite }) => {
  return (
    <div className="group relative bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-blue-500 transition-all cursor-pointer">
      {/* Preview */}
      <div className="aspect-square bg-gray-900 flex items-center justify-center p-4">
        {block.media ? (
          <img src={block.media} alt={block.label} className="w-full h-full object-contain" />
        ) : (
          <div className="text-4xl text-gray-600">📦</div>
        )}
      </div>

      {/* Label */}
      <div className="p-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-white truncate">{block.label}</span>
          {onToggleFavorite && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(block.id);
              }}
              className="text-gray-400 hover:text-yellow-500 transition-colors"
            >
              <Star
                className={`w-3.5 h-3.5 ${block.isFavorite ? 'fill-yellow-500 text-yellow-500' : ''}`}
              />
            </button>
          )}
        </div>
        <span className="text-xs text-gray-500">{block.category}</span>
      </div>

      {/* Add Button (on hover) */}
      <div
        onClick={onAdd}
        className="absolute inset-0 bg-blue-600/90 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
      >
        <Plus className="w-8 h-8 text-white" />
      </div>
    </div>
  );
};

// Block List Item Component (List View)
const BlockListItem: React.FC<{
  block: Block;
  onAdd: () => void;
  onToggleFavorite?: (id: string) => void;
}> = ({ block, onAdd, onToggleFavorite }) => {
  return (
    <div className="group flex items-center gap-3 p-2 bg-gray-800 rounded hover:bg-gray-700 border border-gray-700 hover:border-blue-500 transition-all cursor-pointer">
      {/* Icon */}
      <div className="w-10 h-10 bg-gray-900 rounded flex items-center justify-center flex-shrink-0">
        {block.media ? (
          <img src={block.media} alt={block.label} className="w-full h-full object-contain" />
        ) : (
          <span className="text-lg">📦</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">{block.label}</div>
        <div className="text-xs text-gray-500">{block.category}</div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(block.id);
            }}
            className="p-1 text-gray-400 hover:text-yellow-500 transition-colors"
          >
            <Star
              className={`w-4 h-4 ${block.isFavorite ? 'fill-yellow-500 text-yellow-500' : ''}`}
            />
          </button>
        )}
        <button
          onClick={onAdd}
          className="p-1 text-gray-400 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
