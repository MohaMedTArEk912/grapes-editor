import React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronUp,
  Wifi,
  WifiOff,
  User,
} from 'lucide-react';
import { usePanelState } from '../../context/PanelStateContext';

interface StatusBarProps {
  saveState?: 'saved' | 'saving' | 'error' | 'unsaved';
  syncState?: 'synced' | 'syncing' | 'offline';
  selectedComponent?: string;
  collaborators?: number;
  lastSaved?: Date;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  saveState = 'saved',
  syncState = 'synced',
  selectedComponent,
  collaborators = 0,
  lastSaved,
}) => {
  const { panelState, toggleBottomBar } = usePanelState();

  const saveStateConfig = {
    saved: { icon: CheckCircle2, text: 'All changes saved', color: 'text-green-500' },
    saving: { icon: Loader2, text: 'Saving...', color: 'text-blue-500' },
    error: { icon: AlertCircle, text: 'Save failed', color: 'text-red-500' },
    unsaved: { icon: AlertCircle, text: 'Unsaved changes', color: 'text-yellow-500' },
  };

  const syncStateConfig = {
    synced: { icon: Wifi, color: 'text-green-500' },
    syncing: { icon: Loader2, color: 'text-blue-500' },
    offline: { icon: WifiOff, color: 'text-red-500' },
  };

  const saveConfig = saveStateConfig[saveState];
  const syncConfig = syncStateConfig[syncState];

  const SaveIcon = saveConfig.icon;
  const SyncIcon = syncConfig.icon;

  if (panelState.bottomBarCollapsed) {
    return (
      <div className="h-8 bg-gray-900 border-t border-gray-800 flex items-center justify-between px-4">
        <button
          onClick={toggleBottomBar}
          className="text-gray-400 hover:text-white p-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Expand status bar"
        >
          <ChevronUp className="w-4 h-4 rotate-180" />
        </button>
      </div>
    );
  }

  return (
    <div className="h-8 bg-gray-900 border-t border-gray-800 flex items-center justify-between px-4 text-xs">
      {/* Left: Save & Sync Status */}
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-1.5 ${saveConfig.color}`}>
          <SaveIcon className={`w-3.5 h-3.5 ${saveState === 'saving' ? 'animate-spin' : ''}`} />
          <span>{saveConfig.text}</span>
          {lastSaved && saveState === 'saved' && (
            <span className="text-gray-500 ml-1">
              • {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className={`flex items-center gap-1.5 ${syncConfig.color}`}>
          <SyncIcon className={`w-3.5 h-3.5 ${syncState === 'syncing' ? 'animate-spin' : ''}`} />
          <span className="text-gray-400 capitalize">{syncState}</span>
        </div>
      </div>

      {/* Center: Selection Info */}
      <div className="flex items-center gap-2 text-gray-400">
        {selectedComponent ? (
          <>
            <span>Selected:</span>
            <span className="text-white font-medium">{selectedComponent}</span>
          </>
        ) : (
          <span>No selection</span>
        )}
      </div>

      {/* Right: Collaborators & Collapse */}
      <div className="flex items-center gap-3">
        {collaborators > 0 && (
          <div className="flex items-center gap-1.5 text-gray-400">
            <User className="w-3.5 h-3.5" />
            <span>{collaborators} online</span>
          </div>
        )}

        <button
          onClick={toggleBottomBar}
          className="text-gray-400 hover:text-white p-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Collapse status bar"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
