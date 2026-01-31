import React, { useEffect, useState } from 'react';
import { ProjectService, ProjectData } from '../../services/projectService';
import {
  X,
  Search,
  Grid3x3,
  List,
  FolderOpen,
  Trash2,
  Copy,
  Calendar,
  Cloud,
  Archive,
  Plus,
} from 'lucide-react';

interface EnhancedProjectPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadProject: (project: ProjectData) => void;
  onCreateNew?: () => void;
}

export const EnhancedProjectPicker: React.FC<EnhancedProjectPickerProps> = ({
  isOpen,
  onClose,
  onLoadProject,
  onCreateNew,
}) => {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'modified'>('modified');

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
    if (confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      try {
        await ProjectService.deleteProject(id);
        loadProjects();
      } catch (err) {
        alert('Failed to delete project');
      }
    }
  };

  const handleDuplicate = async (e: React.MouseEvent, _project: ProjectData) => {
    e.stopPropagation();
    // Implement duplication logic
    alert('Duplication feature coming soon!');
  };

  const handleArchive = async (e: React.MouseEvent, _id: string) => {
    e.stopPropagation();
    // Implement archive logic
    alert('Archive feature coming soon!');
  };

  // Filter and sort projects
  const filteredProjects = projects
    .filter((p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-6 h-6 text-blue-500" />
            <h2 className="text-2xl font-bold text-white">Projects</h2>
          </div>
          <div className="flex items-center gap-2">
            {onCreateNew && (
              <button
                onClick={onCreateNew}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Project
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search and Controls */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-800">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'modified')}
            className="px-4 py-2.5 bg-gray-800 border border-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="modified">Recently Modified</option>
            <option value="name">Name (A-Z)</option>
          </select>

          <div className="flex items-center bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Projects List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-400">Loading projects...</p>
              </div>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FolderOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg mb-2">
                  {searchQuery ? 'No projects found' : 'No projects yet'}
                </p>
                <p className="text-gray-600 text-sm">
                  {searchQuery ? 'Try a different search term' : 'Create your first project to get started!'}
                </p>
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project._id}
                  project={project}
                  onSelect={() => onLoadProject(project)}
                  onDelete={(e) => handleDelete(e, project._id!)}
                  onDuplicate={(e) => handleDuplicate(e, project)}
                  onArchive={(e) => handleArchive(e, project._id!)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredProjects.map((project) => (
                <ProjectListItem
                  key={project._id}
                  project={project}
                  onSelect={() => onLoadProject(project)}
                  onDelete={(e) => handleDelete(e, project._id!)}
                  onDuplicate={(e) => handleDuplicate(e, project)}
                  onArchive={(e) => handleArchive(e, project._id!)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Project Card Component (Grid View)
const ProjectCard: React.FC<{
  project: ProjectData;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onDuplicate: (e: React.MouseEvent) => void;
  onArchive: (e: React.MouseEvent) => void;
}> = ({ project, onSelect, onDelete, onDuplicate, onArchive }) => {
  const lastModified = project.updatedAt
    ? new Date(project.updatedAt).toLocaleDateString()
    : 'Never';

  return (
    <div
      onClick={onSelect}
      className="group bg-gray-800 rounded-lg border border-gray-700 hover:border-blue-500 hover:shadow-xl transition-all cursor-pointer overflow-hidden"
    >
      {/* Preview/Thumbnail */}
      <div className="aspect-video bg-gray-900 flex items-center justify-center border-b border-gray-700">
        <FolderOpen className="w-12 h-12 text-gray-600" />
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-white font-semibold text-lg mb-2 truncate">{project.name}</h3>

        <div className="space-y-1.5 text-xs text-gray-400 mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" />
            <span>Modified: {lastModified}</span>
          </div>
          <div className="flex items-center gap-2">
            <Cloud className="w-3.5 h-3.5" />
            <span>Updated: {lastModified}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onDuplicate}
            className="flex-1 px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors"
            title="Duplicate"
          >
            <Copy className="w-3.5 h-3.5 mx-auto" />
          </button>
          <button
            onClick={onArchive}
            className="flex-1 px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors"
            title="Archive"
          >
            <Archive className="w-3.5 h-3.5 mx-auto" />
          </button>
          <button
            onClick={onDelete}
            className="flex-1 px-2 py-1.5 bg-red-900/50 hover:bg-red-900 text-red-400 hover:text-white text-xs rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5 mx-auto" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Project List Item Component (List View)
const ProjectListItem: React.FC<{
  project: ProjectData;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onDuplicate: (e: React.MouseEvent) => void;
  onArchive: (e: React.MouseEvent) => void;
}> = ({ project, onSelect, onDelete, onDuplicate, onArchive }) => {
  const lastModified = project.updatedAt
    ? new Date(project.updatedAt).toLocaleDateString()
    : 'Never';

  return (
    <div
      onClick={onSelect}
      className="group flex items-center gap-4 p-4 bg-gray-800 rounded-lg border border-gray-700 hover:border-blue-500 hover:bg-gray-700 transition-all cursor-pointer"
    >
      {/* Icon */}
      <div className="w-12 h-12 bg-gray-900 rounded flex items-center justify-center flex-shrink-0">
        <FolderOpen className="w-6 h-6 text-gray-600" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-white font-semibold text-base mb-1 truncate">{project.name}</h3>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span>Modified: {lastModified}</span>
          <span>Updated: {lastModified}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onDuplicate}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          title="Duplicate"
        >
          <Copy className="w-4 h-4" />
        </button>
        <button
          onClick={onArchive}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          title="Archive"
        >
          <Archive className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-red-400 hover:text-white hover:bg-red-900/50 rounded transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
