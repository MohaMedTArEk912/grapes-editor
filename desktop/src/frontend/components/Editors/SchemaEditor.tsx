/**
 * Schema Editor Component
 * 
 * Manages database models and their fields.
 * Provides CRUD operations for data models and fields.
 */

import React, { useState } from "react";
import { useProjectStore } from "../../hooks/useProjectStore";
import { addDataModel, addField } from "../../stores/projectStore";
import { DataModelSchema, FieldSchema } from "../../hooks/useTauri";

const FIELD_TYPES = [
    "String",
    "Int",
    "Float",
    "Boolean",
    "DateTime",
    "Json",
    "Text",
    "UUID",
];

/**
 * SchemaEditor - Main component for managing database schema
 */
const SchemaEditor: React.FC = () => {
    const { project, loading } = useProjectStore();
    const [isAddingModel, setIsAddingModel] = useState(false);
    const [newModelName, setNewModelName] = useState("");
    const [error, setError] = useState<string | null>(null);

    const models = project?.data_models?.filter(m => !m.archived) || [];

    /**
     * Handle creating a new data model
     */
    const handleAddModel = async () => {
        if (!newModelName.trim()) {
            setError("Model name is required");
            return;
        }

        try {
            setError(null);
            await addDataModel(newModelName.trim());
            setNewModelName("");
            setIsAddingModel(false);
        } catch (err) {
            setError(String(err));
        }
    };

    return (
        <div className="h-full flex flex-col bg-[var(--ide-bg)] text-[var(--ide-text)]">
            {/* Header */}
            <div className="p-4 border-b border-[var(--ide-border)] flex items-center justify-between bg-[var(--ide-chrome)]">
                <div className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-[#5a67d8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                    </svg>
                    <h1 className="text-lg font-semibold text-[var(--ide-text)]">Database Schema</h1>
                    <span className="text-xs text-[var(--ide-text-muted)]">({models.length} models)</span>
                </div>
                <button
                    onClick={() => setIsAddingModel(true)}
                    className="px-3 py-1.5 bg-[var(--ide-primary)] hover:bg-[var(--ide-primary-hover)] text-white text-sm rounded transition-colors"
                    aria-label="Add new data model"
                >
                    + Add Model
                </button>
            </div>

            {/* Error Display */}
            {error && (
                <div className="mx-4 mt-4 p-3 bg-[#5a1d1d] border border-[#be1100] rounded text-sm text-[#f48771]">
                    {error}
                </div>
            )}

            {/* Add Model Form */}
            {isAddingModel && (
                <div className="m-4 p-4 bg-[var(--ide-bg-panel)] border border-[var(--ide-border)] rounded">
                    <h3 className="text-sm font-medium text-[var(--ide-text)] mb-3">New Data Model</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs text-[var(--ide-text-secondary)] mb-1">Model Name</label>
                            <input
                                type="text"
                                value={newModelName}
                                onChange={(e) => setNewModelName(e.target.value)}
                                placeholder="e.g., User, Product, Order"
                                className="w-full px-3 py-2 bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded text-sm text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus:outline-none focus:border-[var(--ide-primary)]"
                                autoFocus
                            />
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={handleAddModel}
                                disabled={loading}
                                className="px-4 py-2 bg-[var(--ide-primary)] hover:bg-[var(--ide-primary-hover)] text-white text-sm rounded transition-colors disabled:opacity-50"
                            >
                                Create
                            </button>
                            <button
                                onClick={() => { setIsAddingModel(false); setNewModelName(""); setError(null); }}
                                className="px-4 py-2 bg-[var(--ide-bg-elevated)] hover:bg-[var(--ide-bg-sidebar)] text-[var(--ide-text)] text-sm rounded transition-colors border border-[var(--ide-border)]"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Models List */}
            <div className="flex-1 overflow-auto p-4">
                {models.length === 0 ? (
                    <div className="text-center py-12">
                        <svg className="w-12 h-12 mx-auto mb-4 text-[var(--ide-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                        </svg>
                        <p className="text-[var(--ide-text-secondary)] text-sm">No data models yet</p>
                        <p className="text-[var(--ide-text-muted)] text-xs mt-1">Click "Add Model" to create one</p>
                    </div>
                ) : (
                    <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                        {models.map((model) => (
                            <ModelCard key={model.id} model={model} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

/**
 * ModelCard - Individual data model card with fields
 */
interface ModelCardProps {
    model: DataModelSchema;
}

const ModelCard: React.FC<ModelCardProps> = ({ model }) => {
    const [isAddingField, setIsAddingField] = useState(false);
    const [newField, setNewField] = useState({
        name: "",
        fieldType: "String",
        required: true,
    });
    const [error, setError] = useState<string | null>(null);

    /**
     * Handle adding a field to the model
     */
    const handleAddField = async () => {
        if (!newField.name.trim()) {
            setError("Field name is required");
            return;
        }

        try {
            setError(null);
            await addField(model.id, newField.name.trim(), newField.fieldType, newField.required);
            setNewField({ name: "", fieldType: "String", required: true });
            setIsAddingField(false);
        } catch (err) {
            setError(String(err));
        }
    };

    return (
        <div className="bg-[var(--ide-bg-panel)] border border-[var(--ide-border)] rounded overflow-hidden">
            {/* Model Header */}
            <div className="px-4 py-3 bg-[var(--ide-bg-elevated)] border-b border-[var(--ide-border)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#5a67d8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7" />
                    </svg>
                    <h3 className="font-semibold text-[var(--ide-text)]">{model.name}</h3>
                </div>
                <div className="flex items-center gap-1 text-[10px]">
                    {model.timestamps && (
                        <span className="px-1.5 py-0.5 bg-[#2d4a3e] text-[#4ec9b0] rounded">timestamps</span>
                    )}
                    {model.soft_delete && (
                        <span className="px-1.5 py-0.5 bg-[#3d3a2d] text-[#dcdcaa] rounded">soft delete</span>
                    )}
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="mx-3 mt-3 p-2 bg-[#5a1d1d] border border-[#be1100] rounded text-xs text-[#f48771]">
                    {error}
                </div>
            )}

            {/* Fields List */}
            <div className="p-3">
                {model.fields?.length > 0 ? (
                    <div className="space-y-1">
                        {model.fields.map((field, idx) => (
                            <FieldRow key={idx} field={field} />
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-[var(--ide-text-muted)] text-center py-2">No fields defined</p>
                )}
            </div>

            {/* Add Field Form */}
            {isAddingField ? (
                <div className="p-3 border-t border-[var(--ide-border)] bg-[var(--ide-bg-elevated)]">
                    <div className="flex gap-2 mb-2">
                        <input
                            type="text"
                            value={newField.name}
                            onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                            placeholder="Field name"
                            className="flex-1 px-2 py-1.5 bg-[var(--ide-bg-panel)] border border-[var(--ide-border)] rounded text-xs text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus:outline-none focus:border-[var(--ide-primary)]"
                            autoFocus
                        />
                        <select
                            value={newField.fieldType}
                            onChange={(e) => setNewField({ ...newField, fieldType: e.target.value })}
                            className="px-2 py-1.5 bg-[var(--ide-bg-panel)] border border-[var(--ide-border)] rounded text-xs text-[var(--ide-text)] focus:outline-none focus:border-[var(--ide-primary)]"
                        >
                            {FIELD_TYPES.map((t) => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs text-[var(--ide-text-secondary)]">
                            <input
                                type="checkbox"
                                checked={newField.required}
                                onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
                                className="rounded"
                            />
                            Required
                        </label>
                        <div className="flex gap-2">
                            <button
                                onClick={handleAddField}
                                className="px-3 py-1 bg-[var(--ide-primary)] hover:bg-[var(--ide-primary-hover)] text-white text-xs rounded transition-colors"
                            >
                                Add
                            </button>
                            <button
                                onClick={() => { setIsAddingField(false); setNewField({ name: "", fieldType: "String", required: true }); setError(null); }}
                                className="px-3 py-1 bg-[var(--ide-bg-panel)] hover:bg-[var(--ide-bg-sidebar)] text-[var(--ide-text)] text-xs rounded transition-colors border border-[var(--ide-border)]"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => setIsAddingField(true)}
                    className="w-full py-2 text-xs text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-bg-elevated)] border-t border-[var(--ide-border)] transition-colors"
                >
                    + Add Field
                </button>
            )}
        </div>
    );
};

/**
 * FieldRow - Single field display row
 */
interface FieldRowProps {
    field: FieldSchema;
}

const FieldRow: React.FC<FieldRowProps> = ({ field }) => {
    const typeColor = {
        String: "text-[#ce9178]",
        Int: "text-[#b5cea8]",
        Float: "text-[#b5cea8]",
        Boolean: "text-[#569cd6]",
        DateTime: "text-[#4ec9b0]",
        Json: "text-[#dcdcaa]",
        Text: "text-[#ce9178]",
        UUID: "text-[#9cdcfe]",
    }[field.field_type] || "text-[#cccccc]";

    return (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--ide-bg-elevated)] text-xs">
            <span className="text-[var(--ide-text)] font-medium flex-1">{field.name}</span>
            <span className={`font-mono ${typeColor}`}>{field.field_type}</span>
            {field.primary_key && (
                <span className="px-1 py-0.5 bg-[#3d3a2d] text-[#dcdcaa] text-[9px] rounded">PK</span>
            )}
            {field.required && !field.primary_key && (
                <span className="px-1 py-0.5 bg-[#5a1d1d] text-[#f48771] text-[9px] rounded">req</span>
            )}
            {field.unique && (
                <span className="px-1 py-0.5 bg-[#2d4a3e] text-[#4ec9b0] text-[9px] rounded">unique</span>
            )}
        </div>
    );
};

export default SchemaEditor;
