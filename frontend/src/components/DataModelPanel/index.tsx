import React, { useCallback, useEffect, useState } from 'react';
import { Database, Plus, Trash2, X, Pencil } from 'lucide-react';
import {
    Collection,
    createCollection,
    deleteCollection,
    getCollections,
    updateCollection,
    CollectionItem,
    getCollectionItems,
    createCollectionItem,
    updateCollectionItem,
    deleteCollectionItem,
} from '../../services/cmsService';

const getErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error) return err.message;
    return fallback;
};

export const DataModelPanel: React.FC = () => {
    const [collections, setCollections] = useState<Collection[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'collections' | 'erd' | 'generators'>('collections');
    const [showCreate, setShowCreate] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [fieldName, setFieldName] = useState('');
    const [fieldType, setFieldType] = useState<Collection['fields'][number]['type']>('text');
    const [fieldRequired, setFieldRequired] = useState(false);
    const [fieldDefault, setFieldDefault] = useState('');
    const [fieldReference, setFieldReference] = useState('');
    const [fieldMin, setFieldMin] = useState('');
    const [fieldMax, setFieldMax] = useState('');
    const [fieldPattern, setFieldPattern] = useState('');
    const [showItems, setShowItems] = useState(false);
    const [itemsCollection, setItemsCollection] = useState<Collection | null>(null);
    const [items, setItems] = useState<CollectionItem[]>([]);
    const [itemData, setItemData] = useState('{}');
    const [itemStatus, setItemStatus] = useState<CollectionItem['status']>('draft');
    const [generatorCollectionId, setGeneratorCollectionId] = useState<string>('');

    const resetFieldForm = () => {
        setFieldName('');
        setFieldDefault('');
        setFieldRequired(false);
        setFieldType('text');
        setFieldReference('');
        setFieldMin('');
        setFieldMax('');
        setFieldPattern('');
    };

    const toSnake = (value: string) =>
        value
            .replace(/([a-z])([A-Z])/g, '$1_$2')
            .replace(/\s+/g, '_')
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .toLowerCase();

    const getMongoSchema = (collection: Collection) => {
        return (collection.fields || []).reduce<Record<string, unknown>>((acc, field) => {
            const base: Record<string, unknown> = {
                type: field.type,
                required: field.required || false,
            };
            if (field.defaultValue !== undefined) base.default = field.defaultValue;
            if (field.reference) base.reference = field.reference;
            if (field.validations) base.validations = field.validations;
            acc[field.name] = base;
            return acc;
        }, {});
    };

    const getSqlType = (type: Collection['fields'][number]['type']) => {
        switch (type) {
            case 'number':
                return 'DOUBLE PRECISION';
            case 'boolean':
                return 'BOOLEAN';
            case 'date':
                return 'TIMESTAMP';
            case 'reference':
                return 'VARCHAR(24)';
            case 'image':
            case 'richtext':
            case 'text':
            default:
                return 'TEXT';
        }
    };

    const getSqlTable = (collection: Collection) => {
        const table = toSnake(collection.name || 'collection');
        const columns = (collection.fields || []).map((field) => {
            const column = `${toSnake(field.name)} ${getSqlType(field.type)}${field.required ? ' NOT NULL' : ''}`;
            return column;
        });
        return `CREATE TABLE ${table} (\n  id UUID PRIMARY KEY,\n  ${columns.join(',\n  ')}\n);`;
    };

    const getSeedData = (collection: Collection, count = 2) => {
        const makeValue = (field: Collection['fields'][number], index: number) => {
            switch (field.type) {
                case 'number':
                    return index + 1;
                case 'boolean':
                    return index % 2 === 0;
                case 'date':
                    return new Date(Date.now() - index * 86400000).toISOString();
                case 'image':
                    return `https://picsum.photos/seed/${field.name}-${index}/600/400`;
                case 'reference':
                    return `${field.reference || 'collection'}_id_${index + 1}`;
                case 'richtext':
                    return `<p>${field.name} sample ${index + 1}</p>`;
                case 'text':
                default:
                    return `${field.name} sample ${index + 1}`;
            }
        };

        return Array.from({ length: count }).map((_, index) => {
            return (collection.fields || []).reduce<Record<string, unknown>>((acc, field) => {
                acc[field.name] = makeValue(field, index);
                return acc;
            }, {});
        });
    };

    const getApiDocs = () => {
        return `# CMS API\n\n## Collections\n- GET /api/cms/collections\n- POST /api/cms/collections\n- GET /api/cms/collections/:id\n- PUT /api/cms/collections/:id\n- DELETE /api/cms/collections/:id\n\n## Collection Items\n- GET /api/cms/collections/:id/items\n- POST /api/cms/collections/:id/items\n- PUT /api/cms/items/:id\n- DELETE /api/cms/items/:id\n\n## Example Collection Payload\n\n{\n  \"name\": \"Blog Posts\",\n  \"description\": \"Content\",\n  \"fields\": [\n    { \"name\": \"title\", \"type\": \"text\", \"required\": true },\n    { \"name\": \"author\", \"type\": \"reference\", \"reference\": \"Authors\" }\n  ]\n}`;
    };

    const loadCollections = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getCollections();
            setCollections(data);
            setError(null);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load collections'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCollections();
    }, [loadCollections]);

    useEffect(() => {
        if (!generatorCollectionId && collections.length > 0) {
            setGeneratorCollectionId(collections[0]._id);
        }
    }, [collections, generatorCollectionId]);

    const handleCreate = async () => {
        if (!name.trim()) return;
        try {
            const created = await createCollection({ name: name.trim(), description: description.trim() || undefined });
            setCollections([created, ...collections]);
            setName('');
            setDescription('');
            setShowCreate(false);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to create collection'));
        }
    };

    const openEdit = (collection: Collection) => {
        setEditingCollection({ ...collection });
        setShowEdit(true);
    };

    const handleEditField = (index: number) => {
        if (!editingCollection) return;
        const field = editingCollection.fields[index];
        setFieldName(field.name);
        setFieldType(field.type);
        setFieldRequired(Boolean(field.required));
        setFieldDefault(field.defaultValue ? String(field.defaultValue) : '');
        setFieldReference(field.reference || '');
        setFieldMin(field.validations?.min !== undefined ? String(field.validations.min) : '');
        setFieldMax(field.validations?.max !== undefined ? String(field.validations.max) : '');
        setFieldPattern(field.validations?.pattern || '');
        setEditingCollection({
            ...editingCollection,
            fields: editingCollection.fields.filter((_, i) => i !== index),
        });
    };

    const handleAddField = () => {
        if (!editingCollection || !fieldName.trim()) return;
        const validations = {
            ...(fieldMin ? { min: Number(fieldMin) } : {}),
            ...(fieldMax ? { max: Number(fieldMax) } : {}),
            ...(fieldPattern ? { pattern: fieldPattern } : {}),
        };
        const next = {
            name: fieldName.trim(),
            type: fieldType,
            required: fieldRequired,
            defaultValue: fieldDefault || undefined,
            reference: fieldType === 'reference' && fieldReference ? fieldReference : undefined,
            validations: Object.keys(validations).length ? validations : undefined,
        };
        setEditingCollection({
            ...editingCollection,
            fields: [...(editingCollection.fields || []), next],
        });
        resetFieldForm();
    };

    const handleRemoveField = (index: number) => {
        if (!editingCollection) return;
        const nextFields = editingCollection.fields.filter((_, i) => i !== index);
        setEditingCollection({
            ...editingCollection,
            fields: nextFields,
        });
    };

    const handleSaveCollection = async () => {
        if (!editingCollection) return;
        try {
            const updated = await updateCollection(editingCollection._id, {
                name: editingCollection.name,
                description: editingCollection.description,
                fields: editingCollection.fields,
            });
            setCollections(collections.map((c) => (c._id === updated._id ? updated : c)));
            setShowEdit(false);
            setEditingCollection(null);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to update collection'));
        }
    };

    const openItems = async (collection: Collection) => {
        setItemsCollection(collection);
        setShowItems(true);
        try {
            const data = await getCollectionItems(collection._id);
            setItems(data);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load items'));
        }
    };

    const handleCreateItem = async () => {
        if (!itemsCollection) return;
        try {
            const parsed = JSON.parse(itemData || '{}');
            const created = await createCollectionItem(itemsCollection._id, parsed, itemStatus);
            setItems([created, ...items]);
            setItemData('{}');
            setItemStatus('draft');
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to create item'));
        }
    };

    const handleUpdateItem = async (item: CollectionItem) => {
        try {
            const updated = await updateCollectionItem(item._id, item.data, item.status);
            setItems(items.map((i) => (i._id === updated._id ? updated : i)));
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to update item'));
        }
    };

    const handleDeleteItem = async (id: string) => {
        if (!confirm('Delete this item?')) return;
        try {
            await deleteCollectionItem(id);
            setItems(items.filter((i) => i._id !== id));
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to delete item'));
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this collection and all items?')) return;
        try {
            await deleteCollection(id);
            setCollections(collections.filter((c) => c._id !== id));
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to delete collection'));
        }
    };

    const erdNodes = collections.map((collection, index) => {
        const columns = 3;
        const width = 220;
        const rowHeight = 150;
        const colGap = 40;
        const rowGap = 30;
        const row = Math.floor(index / columns);
        const col = index % columns;
        return {
            id: collection._id,
            name: collection.name,
            x: col * (width + colGap),
            y: row * (rowHeight + rowGap),
            width,
            height: Math.max(80, 24 + (collection.fields?.length || 0) * 18),
            fields: collection.fields || [],
        };
    });

    const erdEdges = collections.flatMap((collection) => {
        return (collection.fields || [])
            .filter((field) => field.type === 'reference' && field.reference)
            .map((field) => ({
                from: collection._id,
                toName: field.reference as string,
                label: field.name,
            }));
    });

    return (
        <div className="p-4 text-slate-200">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Database size={18} />
                    Data Models
                </h3>
                <button
                    onClick={() => setShowCreate(true)}
                    className="p-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
                    aria-label="Add collection"
                >
                    <Plus size={16} />
                </button>
            </div>

            <div className="flex items-center gap-2 mb-4 text-xs">
                {(['collections', 'erd', 'generators'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-3 py-1 rounded border transition-colors ${
                            activeTab === tab
                                ? 'bg-indigo-500/20 text-indigo-200 border-indigo-500/40'
                                : 'bg-[#0a0a1a] text-slate-400 border-[#2a2a4a] hover:text-white'
                        }`}
                    >
                        {tab === 'collections' ? 'Collections' : tab === 'erd' ? 'ERD' : 'Generators'}
                    </button>
                ))}
            </div>

            {error && (
                <div className="mb-3 p-2 bg-red-500/20 text-red-300 rounded text-sm flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="text-red-300">
                        <X size={14} />
                    </button>
                </div>
            )}

            {loading && collections.length === 0 && (
                <div className="text-slate-400 text-sm">Loading collections...</div>
            )}

            {!loading && collections.length === 0 && (
                <div className="text-slate-400 text-sm">No collections yet.</div>
            )}

            {activeTab === 'collections' && (
                <div className="space-y-2">
                    {collections.map((collection) => (
                        <div
                            key={collection._id}
                            className="flex items-center justify-between p-3 rounded-lg bg-[#141428] border border-[#2a2a4a]"
                        >
                            <div className="min-w-0">
                                <div className="font-medium truncate">{collection.name}</div>
                                {collection.description && (
                                    <div className="text-xs text-slate-400 truncate">{collection.description}</div>
                                )}
                                <div className="text-xs text-slate-500 mt-1">
                                    Fields: {collection.fields?.length || 0}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => openEdit(collection)}
                                    className="text-slate-400 hover:text-white p-1"
                                    title="Edit fields"
                                >
                                    <Pencil size={16} />
                                </button>
                                <button
                                    onClick={() => openItems(collection)}
                                    className="text-slate-400 hover:text-white p-1"
                                    title="Manage items"
                                >
                                    <Database size={16} />
                                </button>
                                <button
                                    onClick={() => handleDelete(collection._id)}
                                    className="text-red-400 hover:text-red-300 p-1"
                                    title="Delete"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'erd' && (
                <div className="relative w-full overflow-auto border border-[#2a2a4a] rounded-lg bg-[#0a0a1a] p-4">
                    {collections.length === 0 ? (
                        <div className="text-sm text-slate-400">No collections to visualize.</div>
                    ) : (
                        <div className="relative" style={{ minWidth: 720, minHeight: 360 }}>
                            <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
                                {erdEdges.map((edge, index) => {
                                    const from = erdNodes.find((node) => node.id === edge.from);
                                    const to = erdNodes.find((node) => node.name === edge.toName);
                                    if (!from || !to) return null;
                                    const x1 = from.x + from.width;
                                    const y1 = from.y + from.height / 2;
                                    const x2 = to.x;
                                    const y2 = to.y + to.height / 2;
                                    return (
                                        <g key={`${edge.from}-${edge.toName}-${index}`}>
                                            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#6366f1" strokeWidth="1.5" />
                                            <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 4} fill="#a5b4fc" fontSize="10">
                                                {edge.label}
                                            </text>
                                        </g>
                                    );
                                })}
                            </svg>
                            {erdNodes.map((node) => (
                                <div
                                    key={node.id}
                                    className="absolute bg-[#141428] border border-[#2a2a4a] rounded-lg px-3 py-2 text-xs text-slate-200"
                                    style={{ left: node.x, top: node.y, width: node.width, minHeight: node.height }}
                                >
                                    <div className="font-semibold mb-1 text-indigo-200">{node.name}</div>
                                    <div className="space-y-1">
                                        {node.fields.map((field) => (
                                            <div key={field.name} className="flex items-center justify-between">
                                                <span className="truncate">{field.name}</span>
                                                <span className="text-[10px] text-slate-400">{field.type}</span>
                                            </div>
                                        ))}
                                        {node.fields.length === 0 && (
                                            <div className="text-[10px] text-slate-500">No fields</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'generators' && (
                <div className="space-y-3">
                    {collections.length === 0 ? (
                        <div className="text-sm text-slate-400">Create a collection to generate schemas.</div>
                    ) : (
                        <>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Collection</label>
                                <select
                                    value={generatorCollectionId}
                                    onChange={(e) => setGeneratorCollectionId(e.target.value)}
                                    className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                >
                                    {collections.map((collection) => (
                                        <option key={collection._id} value={collection._id}>
                                            {collection.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {collections
                                .filter((collection) => collection._id === generatorCollectionId)
                                .map((collection) => (
                                    <div key={collection._id} className="space-y-3">
                                        <div>
                                            <div className="text-xs text-slate-400 mb-1">Mongo schema</div>
                                            <pre className="text-[11px] bg-[#0a0a1a] border border-[#2a2a4a] rounded p-2 overflow-auto max-h-48 text-slate-300">
{JSON.stringify(getMongoSchema(collection), null, 2)}
                                            </pre>
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-400 mb-1">SQL table + migration</div>
                                            <pre className="text-[11px] bg-[#0a0a1a] border border-[#2a2a4a] rounded p-2 overflow-auto max-h-48 text-slate-300">
{getSqlTable(collection)}
\n\n-- Down migration\nDROP TABLE ${toSnake(collection.name || 'collection')};
                                            </pre>
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-400 mb-1">Seed data</div>
                                            <pre className="text-[11px] bg-[#0a0a1a] border border-[#2a2a4a] rounded p-2 overflow-auto max-h-48 text-slate-300">
{JSON.stringify(getSeedData(collection), null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                ))}
                            <div>
                                <div className="text-xs text-slate-400 mb-1">API docs</div>
                                <pre className="text-[11px] bg-[#0a0a1a] border border-[#2a2a4a] rounded p-2 overflow-auto max-h-64 text-slate-300">
{getApiDocs()}
                                </pre>
                            </div>
                        </>
                    )}
                </div>
            )}

            {showCreate && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
                    <div className="w-full max-w-md bg-[#101020] border border-[#2a2a4a] rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold">New Collection</h4>
                            <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Name</label>
                                <input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                    placeholder="Blog Posts"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Description</label>
                                <input
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                    placeholder="Optional"
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setShowCreate(false)}
                                    className="px-3 py-1 text-xs text-slate-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreate}
                                    className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600"
                                >
                                    Create
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showEdit && editingCollection && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
                    <div className="w-full max-w-xl bg-[#101020] border border-[#2a2a4a] rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold">Edit Collection</h4>
                            <button onClick={() => setShowEdit(false)} className="text-slate-400 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-3">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Name</label>
                                    <input
                                        value={editingCollection.name}
                                        onChange={(e) => setEditingCollection({ ...editingCollection, name: e.target.value })}
                                        className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Description</label>
                                    <input
                                        value={editingCollection.description || ''}
                                        onChange={(e) => setEditingCollection({ ...editingCollection, description: e.target.value })}
                                        className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="text-xs text-slate-400 mb-2">Fields</div>
                                <div className="space-y-2">
                                    {(editingCollection.fields || []).map((field, index) => (
                                        <div key={`${field.name}-${index}`} className="flex items-center justify-between bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1">
                                            <div className="text-sm text-slate-200">
                                                {field.name} · {field.type}{field.required ? ' *' : ''}
                                                {field.reference && (
                                                    <span className="text-[11px] text-indigo-300 ml-2">→ {field.reference}</span>
                                                )}
                                                {(field.validations?.min !== undefined || field.validations?.max !== undefined || field.validations?.pattern) && (
                                                    <span className="text-[11px] text-slate-400 ml-2">
                                                        {field.validations?.min !== undefined ? `min ${field.validations.min}` : ''}
                                                        {field.validations?.max !== undefined ? ` max ${field.validations.max}` : ''}
                                                        {field.validations?.pattern ? ` pattern ${field.validations.pattern}` : ''}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleEditField(index)}
                                                    className="text-slate-300 hover:text-white"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveField(index)}
                                                    className="text-red-400 hover:text-red-300"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3">
                                    <div className="text-[11px] text-slate-500 mb-1">Schema preview</div>
                                    <pre className="text-[11px] bg-[#0a0a1a] border border-[#2a2a4a] rounded p-2 overflow-auto max-h-40 text-slate-300">
{JSON.stringify(
    (editingCollection.fields || []).reduce<Record<string, unknown>>((acc, field) => {
        acc[field.name] = {
            type: field.type,
            required: field.required || false,
            default: field.defaultValue ?? undefined,
            reference: field.reference || undefined,
            validations: field.validations || undefined,
        };
        return acc;
    }, {}),
    null,
    2
)}
                                    </pre>
                                </div>
                            </div>

                            <div className="border-t border-[#2a2a4a] pt-3">
                                <div className="text-xs text-slate-400 mb-2">Add Field</div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        value={fieldName}
                                        onChange={(e) => setFieldName(e.target.value)}
                                        className="bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                        placeholder="Field name"
                                    />
                                    <select
                                        value={fieldType}
                                        onChange={(e) => setFieldType(e.target.value as Collection['fields'][number]['type'])}
                                        className="bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                    >
                                        <option value="text">Text</option>
                                        <option value="richtext">Rich Text</option>
                                        <option value="number">Number</option>
                                        <option value="boolean">Boolean</option>
                                        <option value="date">Date</option>
                                        <option value="image">Image</option>
                                        <option value="reference">Reference</option>
                                    </select>
                                    <input
                                        value={fieldDefault}
                                        onChange={(e) => setFieldDefault(e.target.value)}
                                        className="bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                        placeholder="Default value"
                                    />
                                    {fieldType === 'reference' ? (
                                        <select
                                            value={fieldReference}
                                            onChange={(e) => setFieldReference(e.target.value)}
                                            className="bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                        >
                                            <option value="">Select collection</option>
                                            {collections
                                                .filter((collection) => collection._id !== editingCollection._id)
                                                .map((collection) => (
                                                    <option key={collection._id} value={collection.name}>
                                                        {collection.name}
                                                    </option>
                                                ))}
                                        </select>
                                    ) : (
                                        <input
                                            value={fieldPattern}
                                            onChange={(e) => setFieldPattern(e.target.value)}
                                            className="bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                            placeholder="Pattern (regex)"
                                        />
                                    )}
                                    <input
                                        value={fieldMin}
                                        onChange={(e) => setFieldMin(e.target.value)}
                                        className="bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                        placeholder="Min"
                                    />
                                    <input
                                        value={fieldMax}
                                        onChange={(e) => setFieldMax(e.target.value)}
                                        className="bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                        placeholder="Max"
                                    />
                                    <label className="flex items-center gap-2 text-xs text-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={fieldRequired}
                                            onChange={(e) => setFieldRequired(e.target.checked)}
                                        />
                                        Required
                                    </label>
                                </div>
                                <div className="flex justify-end mt-2">
                                    <button
                                        onClick={handleAddField}
                                        className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600"
                                    >
                                        Add Field
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setShowEdit(false)}
                                    className="px-3 py-1 text-xs text-slate-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveCollection}
                                    className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showItems && itemsCollection && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
                    <div className="w-full max-w-2xl bg-[#101020] border border-[#2a2a4a] rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold">Items · {itemsCollection.name}</h4>
                            <button onClick={() => setShowItems(false)} className="text-slate-400 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <div className="text-xs text-slate-400 mb-1">New item (JSON)</div>
                                <textarea
                                    value={itemData}
                                    onChange={(e) => setItemData(e.target.value)}
                                    className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white h-24"
                                />
                                <div className="flex items-center justify-between mt-2">
                                    <select
                                        value={itemStatus}
                                        onChange={(e) => setItemStatus(e.target.value as CollectionItem['status'])}
                                        className="bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white"
                                    >
                                        <option value="draft">Draft</option>
                                        <option value="published">Published</option>
                                    </select>
                                    <button
                                        onClick={handleCreateItem}
                                        className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600"
                                    >
                                        Create Item
                                    </button>
                                </div>
                            </div>

                            <div className="border-t border-[#2a2a4a] pt-3 space-y-2 max-h-64 overflow-auto">
                                {items.length === 0 && (
                                    <div className="text-xs text-slate-400">No items yet.</div>
                                )}
                                {items.map((item) => (
                                    <div key={item._id} className="bg-[#0a0a1a] border border-[#2a2a4a] rounded p-2">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</span>
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={item.status}
                                                    onChange={(e) => {
                                                        const next = e.target.value as CollectionItem['status'];
                                                        const updated = { ...item, status: next };
                                                        setItems(items.map((i) => (i._id === item._id ? updated : i)));
                                                    }}
                                                    className="bg-[#101020] border border-[#2a2a4a] rounded px-2 py-1 text-[11px] text-white"
                                                >
                                                    <option value="draft">Draft</option>
                                                    <option value="published">Published</option>
                                                </select>
                                                <button
                                                    onClick={() => handleUpdateItem(item)}
                                                    className="text-xs text-slate-300 hover:text-white"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteItem(item._id)}
                                                    className="text-xs text-red-400 hover:text-red-300"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                        <pre className="text-[11px] text-slate-300 overflow-auto">
{JSON.stringify(item.data, null, 2)}
                                        </pre>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
