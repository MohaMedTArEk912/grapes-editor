import React, { ReactNode } from 'react';
import { X, Minimize2, Maximize2 } from 'lucide-react';
import { usePanelState, InspectorTab } from '../../context/PanelStateContext';

interface InspectorTabItem {
  id: InspectorTab;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

const tabs: InspectorTabItem[] = [
  { id: 'styles', label: 'Styles' },
  { id: 'traits', label: 'Traits' },
  { id: 'layers', label: 'Layers' },
];

interface RightDrawerProps {
  stylesContent: ReactNode;
  traitsContent: ReactNode;
  layersContent: ReactNode;
}

export const RightDrawer: React.FC<RightDrawerProps> = ({
  stylesContent,
  traitsContent,
  layersContent,
}) => {
  const {
    panelState,
    toggleRightDrawer,
    setActiveInspectorTab,
    toggleCompactMode,
  } = usePanelState();

  return (
    <div
      className={`h-full bg-gray-900 border-l border-gray-800 flex flex-col flex-shrink-0 transition-all duration-200 ${panelState.isRightDrawerOpen ? '' : 'w-0 overflow-hidden opacity-0 pointer-events-none'}`}
      style={{ width: panelState.isRightDrawerOpen ? `${panelState.rightPanelWidth}px` : '0px' }}
      aria-hidden={!panelState.isRightDrawerOpen}
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">Inspector</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleCompactMode}
            className="text-gray-400 hover:text-white p-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={panelState.compactMode ? 'Expand' : 'Compact mode'}
            title={panelState.compactMode ? 'Expand' : 'Compact mode'}
          >
            {panelState.compactMode ? (
              <Maximize2 className="w-4 h-4" />
            ) : (
              <Minimize2 className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={toggleRightDrawer}
            className="text-gray-400 hover:text-white p-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close inspector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {tabs.map((tab) => {
          const isActive = panelState.activeInspectorTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveInspectorTab(tab.id)}
              className={`
                flex-1 px-4 py-2 text-sm font-medium transition-colors
                focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500
                ${
                  isActive
                    ? 'text-white bg-gray-800 border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }
              `}
              aria-selected={isActive}
              role="tab"
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content (keep all mounted for GrapesJS append targets) */}
      <div className={`flex-1 overflow-y-auto ${panelState.compactMode ? 'text-sm' : ''}`}>
        <div className={panelState.activeInspectorTab === 'styles' ? '' : 'hidden'}>
          {stylesContent}
        </div>
        <div className={panelState.activeInspectorTab === 'traits' ? '' : 'hidden'}>
          {traitsContent}
        </div>
        <div className={panelState.activeInspectorTab === 'layers' ? '' : 'hidden'}>
          {layersContent}
        </div>
      </div>
    </div>
  );
};
