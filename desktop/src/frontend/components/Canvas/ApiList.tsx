/**
 * ApiList Component - React version
 * 
 * Displays and manages API endpoints in a list view.
 */

import React, { useState } from "react";
import { addApi } from "../../stores/projectStore";
import { useProjectStore } from "../../hooks/useProjectStore";
import PromptModal from "../UI/PromptModal";
import { useToast } from "../../context/ToastContext";

const ApiList: React.FC = () => {
    const { project } = useProjectStore();
    const [selectedApiId, setSelectedApiId] = useState<string | null>(null);
    const [promptOpen, setPromptOpen] = useState(false);
    const toast = useToast();

    const apis = project?.apis.filter(a => !a.archived) || [];
    const selectedApi = apis.find(a => a.id === selectedApiId);

    const handleAddApi = () => {
        setPromptOpen(true);
    };

    const getMethodColor = (method: string): string => {
        switch (method.toUpperCase()) {
            case "GET":
                return "bg-green-500/20 text-green-400 border-green-500/50";
            case "POST":
                return "bg-blue-500/20 text-blue-400 border-blue-500/50";
            case "PUT":
                return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
            case "PATCH":
                return "bg-orange-500/20 text-orange-400 border-orange-500/50";
            case "DELETE":
                return "bg-red-500/20 text-red-400 border-red-500/50";
            default:
                return "bg-gray-500/20 text-gray-400 border-gray-500/50";
        }
    };

    return (
        <div className="h-full flex">
            {/* API List */}
            <div className="w-80 bg-ide-sidebar border-r border-ide-border flex flex-col flex-shrink-0">
                {/* Header */}
                <div className="h-10 px-4 flex items-center justify-between border-b border-ide-border">
                    <span className="text-xs font-semibold uppercase tracking-wider text-ide-text-muted">
                        API Endpoints
                    </span>
                    <button
                        className="p-1 hover:bg-ide-panel rounded text-ide-text-muted hover:text-ide-accent transition-colors"
                        onClick={handleAddApi}
                        aria-label="Add endpoint"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-auto">
                    {apis.length > 0 ? (
                        <div className="p-2 space-y-1">
                            {apis.map((api) => (
                                <button
                                    key={api.id}
                                    className={`w-full text-left p-3 rounded-lg transition-colors ${selectedApiId === api.id
                                        ? "bg-ide-accent/20 border border-ide-accent/50"
                                        : "hover:bg-ide-panel border border-transparent"
                                        }`}
                                    onClick={() => setSelectedApiId(api.id)}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${getMethodColor(api.method)}`}>
                                            {api.method}
                                        </span>
                                        <span className="text-sm font-mono text-ide-text truncate">
                                            {api.path}
                                        </span>
                                    </div>
                                    <span className="text-xs text-ide-text-muted">{api.name}</span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 text-center text-ide-text-muted text-sm">
                            <p>No API endpoints yet</p>
                            <button
                                className="mt-2 text-ide-accent hover:underline"
                                onClick={handleAddApi}
                            >
                                Create your first endpoint
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <PromptModal
                isOpen={promptOpen}
                title="New API Endpoint"
                confirmText="Create"
                fields={[
                    { name: "method", label: "HTTP method", placeholder: "GET", value: "GET", required: true },
                    { name: "path", label: "API path", placeholder: "/api/", value: "/api/", required: true },
                    { name: "name", label: "Endpoint name", placeholder: "ListUsers", required: true },
                ]}
                onClose={() => setPromptOpen(false)}
                onSubmit={async (values) => {
                    try {
                        const method = values.method.trim().toUpperCase();
                        const path = values.path.trim();
                        const name = values.name.trim();
                        await addApi(method, path, name);
                        toast.success(`API "${name}" created`);
                    } catch (err) {
                        toast.error(`Failed to create API: ${err}`);
                    }
                }}
            />

            {/* API Detail Panel */}
            <div className="flex-1 overflow-auto bg-ide-bg">
                {!selectedApi ? (
                    <div className="h-full flex items-center justify-center text-ide-text-muted">
                        <div className="text-center">
                            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <p className="text-sm">Select an endpoint to view details</p>
                        </div>
                    </div>
                ) : (
                    <div className="p-6">
                        {/* Endpoint Header */}
                        <div className="flex items-center gap-3 mb-6">
                            <span className={`text-sm font-mono px-2 py-1 rounded border ${getMethodColor(selectedApi.method)}`}>
                                {selectedApi.method}
                            </span>
                            <span className="text-xl font-mono text-ide-text">{selectedApi.path}</span>
                        </div>

                        {/* Endpoint Name */}
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-ide-text">{selectedApi.name}</h2>
                            {selectedApi.description && (
                                <p className="mt-2 text-ide-text-muted">{selectedApi.description}</p>
                            )}
                        </div>

                        {/* Sections */}
                        <div className="space-y-6">
                            {/* Request */}
                            <div className="bg-ide-panel rounded-lg p-4 border border-ide-border">
                                <h3 className="text-sm font-semibold text-ide-text mb-3">Request</h3>
                                <div className="bg-ide-bg rounded p-3 font-mono text-sm text-ide-text-muted">
                                    <span className="text-green-400">{selectedApi.method}</span>{" "}
                                    <span className="text-ide-text">{selectedApi.path}</span>
                                </div>
                            </div>

                            {/* Response */}
                            <div className="bg-ide-panel rounded-lg p-4 border border-ide-border">
                                <h3 className="text-sm font-semibold text-ide-text mb-3">Response</h3>
                                <div className="bg-ide-bg rounded p-3 font-mono text-sm text-ide-text-muted">
                                    <pre>{`{
  "success": true,
  "data": {}
}`}</pre>
                                </div>
                            </div>

                            {/* Logic Flow */}
                            <div className="bg-ide-panel rounded-lg p-4 border border-ide-border">
                                <h3 className="text-sm font-semibold text-ide-text mb-3">Handler Logic</h3>
                                {!selectedApi.logic_flow_id ? (
                                    <button className="w-full py-3 border-2 border-dashed border-ide-border rounded-lg text-ide-text-muted hover:border-ide-accent hover:text-ide-accent transition-colors">
                                        + Create Logic Flow
                                    </button>
                                ) : (
                                    <p className="text-sm text-ide-text-muted">
                                        Connected to logic flow: {selectedApi.logic_flow_id}
                                    </p>
                                )}
                            </div>

                            {/* Permissions */}
                            <div className="bg-ide-panel rounded-lg p-4 border border-ide-border">
                                <h3 className="text-sm font-semibold text-ide-text mb-3">Permissions</h3>
                                {selectedApi.permissions.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {selectedApi.permissions.map((perm, idx) => (
                                            <span key={idx} className="px-2 py-1 text-xs rounded bg-purple-500/20 text-purple-400">
                                                {perm}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-sm text-ide-text-muted">Public (no authentication required)</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ApiList;
