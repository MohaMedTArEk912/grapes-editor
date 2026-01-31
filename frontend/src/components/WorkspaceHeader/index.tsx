import React from 'react';
import {
  Monitor,
  Tablet,
  Smartphone,
  Eye,
  Undo2,
  Redo2,
  ChevronDown,
} from 'lucide-react';

interface WorkspaceHeaderProps {
  pageName?: string;
  onPageNameClick?: () => void;
  currentBreakpoint?: string;
  breakpoints?: Array<{ id: string; label: string; width: number }>;
  onBreakpointChange?: (id: string) => void;
  onDeviceToggle?: (device: 'desktop' | 'tablet' | 'mobile') => void;
  currentDevice?: 'desktop' | 'tablet' | 'mobile';
  onPreview?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  pageName = 'Untitled Page',
  onPageNameClick,
  currentBreakpoint = 'desktop',
  breakpoints = [
    { id: 'desktop', label: 'Desktop', width: 1920 },
    { id: 'tablet', label: 'Tablet', width: 768 },
    { id: 'mobile', label: 'Mobile', width: 375 },
  ],
  onBreakpointChange,
  onDeviceToggle,
  currentDevice = 'desktop',
  onPreview,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}) => {
  const deviceIcons = {
    desktop: Monitor,
    tablet: Tablet,
    mobile: Smartphone,
  };

  return (
    <div className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4">
      {/* Left: Page Name */}
      <div className="flex items-center gap-3">
        <button
          onClick={onPageNameClick}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {pageName}
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Center: Device & Breakpoint Controls */}
      <div className="flex items-center gap-2">
        {/* Device Toggle */}
        <div className="flex items-center bg-gray-800 rounded-lg p-1">
          {(['desktop', 'tablet', 'mobile'] as const).map((device) => {
            const Icon = deviceIcons[device];
            const isActive = currentDevice === device;
            return (
              <button
                key={device}
                onClick={() => onDeviceToggle?.(device)}
                className={`
                  p-2 rounded transition-colors
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }
                `}
                aria-label={device}
                aria-pressed={isActive}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>

        {/* Breakpoint Selector */}
        <select
          value={currentBreakpoint}
          onChange={(e) => onBreakpointChange?.(e.target.value)}
          className="px-3 py-2 bg-gray-800 text-white text-sm rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {breakpoints.map((bp) => (
            <option key={bp.id} value={bp.id}>
              {bp.label} ({bp.width}px)
            </option>
          ))}
        </select>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Undo/Redo */}
        <div className="flex items-center gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`
              p-2 rounded transition-colors
              focus:outline-none focus:ring-2 focus:ring-blue-500
              ${
                canUndo
                  ? 'text-gray-400 hover:text-white hover:bg-gray-800'
                  : 'text-gray-600 cursor-not-allowed'
              }
            `}
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`
              p-2 rounded transition-colors
              focus:outline-none focus:ring-2 focus:ring-blue-500
              ${
                canRedo
                  ? 'text-gray-400 hover:text-white hover:bg-gray-800'
                  : 'text-gray-600 cursor-not-allowed'
              }
            `}
            aria-label="Redo"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Preview */}
        <button
          onClick={onPreview}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <Eye className="w-4 h-4" />
          Preview
        </button>
      </div>
    </div>
  );
};
