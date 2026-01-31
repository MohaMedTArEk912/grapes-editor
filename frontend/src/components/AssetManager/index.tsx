import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GrapesEditor } from '../../types/grapes';
import {
    Image, Upload, Trash2, Search, Grid, List, Copy,
    ExternalLink, X, FolderOpen, Check
} from 'lucide-react';
import { FixedSizeGrid, FixedSizeList, GridChildComponentProps, ListChildComponentProps } from 'react-window';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useElementSize } from '../../hooks/useElementSize';

/**
 * @interface AssetManagerProps
 * @description Props for the AssetManager component
 */
interface AssetManagerProps {
    editor: GrapesEditor | null;
    isOpen: boolean;
    onClose: () => void;
    onSelect?: (asset: AssetItem) => void;
}

/**
 * @interface AssetItem
 * @description Represents an asset in the manager
 */
interface AssetItem {
    id: string;
    type: 'image' | 'icon' | 'svg';
    src: string;
    name: string;
    width?: number;
    height?: number;
    size?: number;
}

/**
 * AssetManager Component
 * Full-featured asset manager for images and icons
 * Supports upload, delete, search, and grid/list view
 * 
 * @param {AssetManagerProps} props - Component props
 * @returns {JSX.Element | null} The rendered component or null if not open
 */
export const AssetManager: React.FC<AssetManagerProps> = ({
    editor,
    isOpen,
    onClose,
    onSelect
}) => {
    const [assets, setAssets] = useState<AssetItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedAsset, setSelectedAsset] = useState<AssetItem | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const debouncedSearch = useDebouncedValue(searchTerm, 200);
    const { ref: assetListRef, size: assetListSize } = useElementSize<HTMLDivElement>();

    /**
     * Load assets from the GrapesJS Asset Manager
     */
    const loadAssets = useCallback(() => {
        if (!editor) return;

        const editorAssets = editor.AssetManager.getAll();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mappedAssets: AssetItem[] = editorAssets.map((asset: any, index: number) => ({
            id: `asset_${index}_${Date.now()}`,
            type: detectAssetType(asset.get('src') || ''),
            src: asset.get('src') || '',
            name: asset.get('name') || extractFileName(asset.get('src') || ''),
            width: asset.get('width'),
            height: asset.get('height'),
        }));

        setAssets(mappedAssets);
    }, [editor]);

    useEffect(() => {
        if (isOpen && editor) {
            loadAssets();
        }
    }, [isOpen, editor, loadAssets]);

    /**
     * Detect asset type from URL
     * @param {string} url - The asset URL
     * @returns {'image' | 'icon' | 'svg'} The detected type
     */
    const detectAssetType = (url: string): 'image' | 'icon' | 'svg' => {
        if (url.endsWith('.svg')) return 'svg';
        if (url.includes('icon') || url.includes('fa-')) return 'icon';
        return 'image';
    };

    /**
     * Extract filename from URL
     * @param {string} url - The asset URL
     * @returns {string} The extracted filename
     */
    const extractFileName = (url: string): string => {
        const parts = url.split('/');
        return parts[parts.length - 1] || 'Unnamed';
    };

    /**
     * Handle file upload from input or drag-drop
     * @param {FileList} files - The uploaded files
     */
    const handleFileUpload = async (files: FileList) => {
        if (!editor || files.length === 0) return;

        setIsUploading(true);

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];

                // Validate file type
                if (!file.type.startsWith('image/')) {
                    console.warn(`Skipping non-image file: ${file.name}`);
                    continue;
                }

                // Convert to base64 for local storage (in production, upload to server)
                const base64 = await fileToBase64(file);

                // Add to GrapesJS Asset Manager
                editor.AssetManager.add({
                    src: base64,
                    name: file.name,
                    type: 'image',
                });
            }

            loadAssets();
        } catch (error) {
            console.error('Failed to upload assets:', error);
        } finally {
            setIsUploading(false);
        }
    };

    /**
     * Convert file to base64 string
     * @param {File} file - The file to convert
     * @returns {Promise<string>} The base64 string
     */
    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
        });
    };

    /**
     * Handle asset deletion
     * @param {AssetItem} asset - The asset to delete
     */
    const handleDelete = (asset: AssetItem) => {
        if (!editor) return;

        const confirmed = window.confirm(`Are you sure you want to delete "${asset.name}"?`);
        if (!confirmed) return;

        // Find and remove from GrapesJS
        const editorAssets = editor.AssetManager.getAll();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const assetToRemove = editorAssets.find((a: any) => a.get('src') === asset.src);

        if (assetToRemove) {
            editor.AssetManager.remove(assetToRemove);
            loadAssets();
        }

        if (selectedAsset?.id === asset.id) {
            setSelectedAsset(null);
        }
    };

    /**
     * Handle asset selection
     * @param {AssetItem} asset - The selected asset
     */
    const handleAssetSelect = (asset: AssetItem) => {
        setSelectedAsset(asset);
    };

    /**
     * Confirm asset selection and close
     */
    const handleConfirmSelect = () => {
        if (selectedAsset && onSelect) {
            onSelect(selectedAsset);
        }
        onClose();
    };

    /**
     * Copy asset URL to clipboard
     * @param {string} url - The URL to copy
     */
    const copyToClipboard = async (url: string) => {
        try {
            await navigator.clipboard.writeText(url);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    /**
     * Handle drag events
     */
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(true);
    };

    const handleDragLeave = () => {
        setDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);

        if (e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files);
        }
    };

    // Filter assets based on search term
    const filteredAssets = useMemo(() => {
        if (!debouncedSearch.trim()) return assets;
        const query = debouncedSearch.toLowerCase();
        return assets.filter(asset =>
            asset.name.toLowerCase().includes(query)
        );
    }, [assets, debouncedSearch]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-[#2a2a4a] bg-[#0a0a1a]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                            <Image size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">Asset Manager</h2>
                            <p className="text-xs text-slate-400">{assets.length} assets</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        aria-label="Close Asset Manager"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-3 p-3 border-b border-[#2a2a4a]">
                    {/* Search */}
                    <div className="flex-1 relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search assets..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-[#0a0a1a] border border-[#2a2a4a] rounded-lg text-sm text-white placeholder-slate-500 focus:border-indigo-500 outline-none"
                        />
                    </div>

                    {/* View Toggle */}
                    <div className="flex bg-[#0a0a1a] border border-[#2a2a4a] rounded-lg overflow-hidden">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}
                            aria-label="Grid View"
                        >
                            <Grid size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}
                            aria-label="List View"
                        >
                            <List size={16} />
                        </button>
                    </div>

                    {/* Upload Button */}
                    <label className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg cursor-pointer hover:opacity-90 transition-opacity">
                        <Upload size={16} />
                        <span className="text-sm font-medium">Upload</span>
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                            className="hidden"
                        />
                    </label>
                </div>

                {/* Content Area */}
                <div
                    className={`flex-1 overflow-hidden p-4 ${dragOver ? 'bg-indigo-500/10' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    ref={assetListRef}
                >
                    {isUploading && (
                        <div className="flex items-center justify-center p-8">
                            <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
                        </div>
                    )}

                    {!isUploading && filteredAssets.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center py-12">
                            <FolderOpen size={48} className="text-slate-500 mb-4" />
                            <p className="text-slate-400 mb-2">No assets found</p>
                            <p className="text-xs text-slate-500">
                                Drag & drop images here or click Upload
                            </p>
                        </div>
                    )}

                    {!isUploading && filteredAssets.length > 0 && (
                        viewMode === 'grid' ? (
                            assetListSize.height > 0 && assetListSize.width > 0 ? (
                                <FixedSizeGrid
                                    columnCount={assetListSize.width >= 720 ? 5 : assetListSize.width >= 560 ? 4 : assetListSize.width >= 420 ? 3 : 2}
                                    columnWidth={Math.floor(assetListSize.width / (assetListSize.width >= 720 ? 5 : assetListSize.width >= 560 ? 4 : assetListSize.width >= 420 ? 3 : 2))}
                                    height={assetListSize.height}
                                    rowCount={Math.ceil(filteredAssets.length / (assetListSize.width >= 720 ? 5 : assetListSize.width >= 560 ? 4 : assetListSize.width >= 420 ? 3 : 2))}
                                    rowHeight={160}
                                    width={assetListSize.width}
                                >
                                    {({ columnIndex, rowIndex, style }: GridChildComponentProps) => {
                                        const columns = assetListSize.width >= 720 ? 5 : assetListSize.width >= 560 ? 4 : assetListSize.width >= 420 ? 3 : 2;
                                        const index = rowIndex * columns + columnIndex;
                                        const asset = filteredAssets[index];
                                        if (!asset) return null;
                                        return (
                                            <div style={{ ...style, padding: 6 }}>
                                                <div
                                                    onClick={() => handleAssetSelect(asset)}
                                                    className={`group relative h-full rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${selectedAsset?.id === asset.id
                                                        ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                                                        : 'border-[#2a2a4a] hover:border-slate-600'
                                                        }`}
                                                >
                                                    <img
                                                        src={asset.src}
                                                        alt={asset.name}
                                                        className="w-full h-full object-cover"
                                                        loading="lazy"
                                                    />

                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); copyToClipboard(asset.src); }}
                                                            className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                                                            title="Copy URL"
                                                        >
                                                            <Copy size={14} className="text-white" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(asset); }}
                                                            className="p-2 bg-red-500/50 rounded-lg hover:bg-red-500/70 transition-colors"
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={14} className="text-white" />
                                                        </button>
                                                    </div>

                                                    {selectedAsset?.id === asset.id && (
                                                        <div className="absolute top-2 right-2 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center">
                                                            <Check size={14} className="text-white" />
                                                        </div>
                                                    )}

                                                    <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                                                        <p className="text-xs text-white truncate">{asset.name}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }}
                                </FixedSizeGrid>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                    {filteredAssets.map((asset) => (
                                        <div
                                            key={asset.id}
                                            onClick={() => handleAssetSelect(asset)}
                                            className={`group relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${selectedAsset?.id === asset.id
                                                ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                                                : 'border-[#2a2a4a] hover:border-slate-600'
                                                }`}
                                        >
                                            <img
                                                src={asset.src}
                                                alt={asset.name}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )
                        ) : (
                            assetListSize.height > 0 && assetListSize.width > 0 ? (
                                <FixedSizeList
                                    height={assetListSize.height}
                                    itemCount={filteredAssets.length}
                                    itemSize={72}
                                    width={assetListSize.width}
                                >
                                    {({ index, style }: ListChildComponentProps) => {
                                        const asset = filteredAssets[index];
                                        return (
                                            <div style={{ ...style, paddingBottom: 8 }}>
                                                <div
                                                    onClick={() => handleAssetSelect(asset)}
                                                    className={`flex items-center gap-4 p-3 rounded-lg border-2 cursor-pointer transition-all ${selectedAsset?.id === asset.id
                                                        ? 'border-indigo-500 bg-indigo-500/10'
                                                        : 'border-[#2a2a4a] hover:border-slate-600 hover:bg-white/5'
                                                        }`}
                                                >
                                                    <img
                                                        src={asset.src}
                                                        alt={asset.name}
                                                        className="w-12 h-12 object-cover rounded-lg"
                                                        loading="lazy"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-white font-medium truncate">{asset.name}</p>
                                                        <p className="text-xs text-slate-500 truncate">{asset.src}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); copyToClipboard(asset.src); }}
                                                            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                                            title="Copy URL"
                                                        >
                                                            <Copy size={14} />
                                                        </button>
                                                        <a
                                                            href={asset.src}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                                            title="Open in New Tab"
                                                        >
                                                            <ExternalLink size={14} />
                                                        </a>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(asset); }}
                                                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }}
                                </FixedSizeList>
                            ) : (
                                <div className="space-y-2">
                                    {filteredAssets.map((asset) => (
                                        <div
                                            key={asset.id}
                                            onClick={() => handleAssetSelect(asset)}
                                            className={`flex items-center gap-4 p-3 rounded-lg border-2 cursor-pointer transition-all ${selectedAsset?.id === asset.id
                                                ? 'border-indigo-500 bg-indigo-500/10'
                                                : 'border-[#2a2a4a] hover:border-slate-600 hover:bg-white/5'
                                                }`}
                                        >
                                            <img
                                                src={asset.src}
                                                alt={asset.name}
                                                className="w-12 h-12 object-cover rounded-lg"
                                                loading="lazy"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-white font-medium truncate">{asset.name}</p>
                                                <p className="text-xs text-slate-500 truncate">{asset.src}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); copyToClipboard(asset.src); }}
                                                    className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                                    title="Copy URL"
                                                >
                                                    <Copy size={14} />
                                                </button>
                                                <a
                                                    href={asset.src}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                                    title="Open in New Tab"
                                                >
                                                    <ExternalLink size={14} />
                                                </a>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(asset); }}
                                                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t border-[#2a2a4a] bg-[#0a0a1a]">
                    <p className="text-xs text-slate-500">
                        {selectedAsset ? `Selected: ${selectedAsset.name}` : 'No asset selected'}
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirmSelect}
                            disabled={!selectedAsset}
                            className="px-4 py-2 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Select Asset
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssetManager;
