import React, { useEffect, useState } from 'react';
import { ProjectService, ProjectData } from '../../services/projectService';
import { X, FolderOpen, Trash2 } from 'lucide-react';

interface ProjectListModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoadProject: (project: ProjectData) => void;
}

export const ProjectListModal: React.FC<ProjectListModalProps> = ({ isOpen, onClose, onLoadProject }) => {
    const [projects, setProjects] = useState<ProjectData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadProjects();
        }
    }, [isOpen]);

    const loadProjects = async () => {
        setLoading(true);
        try {
            const data = await ProjectService.getAllProjects();
            setProjects(data);
            setError(null);
        } catch (err) {
            setError('Failed to load projects');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this project?')) {
            try {
                await ProjectService.deleteProject(id);
                loadProjects(); // Refresh list
            } catch (err) {
                alert('Failed to delete project');
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
                >
                    <X size={24} />
                </button>

                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                    <FolderOpen size={24} />
                    Load Project
                </h2>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-8">Loading projects...</div>
                ) : (
                    <div className="grid gap-4 max-h-[60vh] overflow-y-auto">
                        {projects.length === 0 ? (
                            <div className="text-center text-gray-500 py-8">
                                No projects found. Save your first project to see it here!
                            </div>
                        ) : (
                            projects.map((project) => (
                                <div
                                    key={project._id}
                                    onClick={() => onLoadProject(project)}
                                    className="border rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-colors flex justify-between items-center group"
                                >
                                    <div>
                                        <h3 className="font-semibold text-lg">{project.name}</h3>
                                        <p className="text-sm text-gray-500">
                                            Last modified: {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : 'N/A'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={(e) => handleDelete(e, project._id!)}
                                        className="text-red-500 opacity-0 group-hover:opacity-100 p-2 hover:bg-red-100 rounded transition-all"
                                        title="Delete Project"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
