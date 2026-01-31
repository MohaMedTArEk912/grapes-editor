/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useProject } from './ProjectContext';

export type PanelType = 
  | 'project' 
  | 'pages' 
  | 'blocks' 
  | 'assets' 
  | 'logic' 
  | 'data' 
  | 'seo' 
  | 'publish' 
  | 'analytics' 
  | 'accessibility'
  | 'marketplace'
  | 'layout'
  | 'files'
  | 'symbols'
  | 'history'
  | 'collab'
  | 'code'
  | 'commerce';

export type InspectorTab = 'styles' | 'traits' | 'layers';

export interface PanelState {
  // Left rail active panel
  activeLeftPanel: PanelType | null;
  
  // Right drawer state
  isRightDrawerOpen: boolean;
  activeInspectorTab: InspectorTab;
  
  // Panel sizes (for resizable panels)
  leftPanelWidth: number;
  rightPanelWidth: number;
  
  // UI preferences
  compactMode: boolean;
  bottomBarCollapsed: boolean;
}

interface PanelStateContextType {
  panelState: PanelState;
  setActiveLeftPanel: (panel: PanelType | null) => void;
  toggleLeftPanel: (panel: PanelType) => void;
  setActiveInspectorTab: (tab: InspectorTab) => void;
  toggleRightDrawer: () => void;
  setRightDrawerOpen: (open: boolean) => void;
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  toggleCompactMode: () => void;
  toggleBottomBar: () => void;
  resetPanelState: () => void;
}

const defaultPanelState: PanelState = {
  activeLeftPanel: 'blocks',
  isRightDrawerOpen: true,
  activeInspectorTab: 'styles',
  leftPanelWidth: 280,
  rightPanelWidth: 320,
  compactMode: false,
  bottomBarCollapsed: false,
};

const PanelStateContext = createContext<PanelStateContextType | undefined>(undefined);

const STORAGE_KEY = 'grapes_panel_state';

export const PanelStateProvider: React.FC<{ children: ReactNode; projectId?: string }> = ({ children, projectId }) => {
  const { currentProject } = useProject();
  const resolvedProjectId = projectId ?? currentProject?._id;

  const getStorageKey = useCallback(() => {
    return resolvedProjectId ? `${STORAGE_KEY}_${resolvedProjectId}` : STORAGE_KEY;
  }, [resolvedProjectId]);

  const loadPanelState = useCallback((): PanelState => {
    try {
      const stored = localStorage.getItem(getStorageKey());
      if (stored) {
        const parsed = JSON.parse(stored);
        // Always ensure right drawer is open by default
        return { ...defaultPanelState, ...parsed, isRightDrawerOpen: parsed.isRightDrawerOpen ?? true };
      }
    } catch (error) {
      console.error('Failed to load panel state:', error);
    }
    return defaultPanelState;
  }, [getStorageKey]);

  const [panelState, setPanelState] = useState<PanelState>(loadPanelState);

  // Save to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(panelState));
    } catch (error) {
      console.error('Failed to save panel state:', error);
    }
  }, [panelState, getStorageKey]);

  // Reload state when project changes
  useEffect(() => {
    setPanelState(loadPanelState());
  }, [resolvedProjectId, loadPanelState]);

  const setActiveLeftPanel = useCallback((panel: PanelType | null) => {
    setPanelState(prev => ({ ...prev, activeLeftPanel: panel }));
  }, []);

  const toggleLeftPanel = useCallback((panel: PanelType) => {
    setPanelState(prev => ({
      ...prev,
      activeLeftPanel: prev.activeLeftPanel === panel ? null : panel,
    }));
  }, []);

  const setActiveInspectorTab = useCallback((tab: InspectorTab) => {
    setPanelState(prev => ({
      ...prev,
      activeInspectorTab: tab,
      isRightDrawerOpen: true,
    }));
  }, []);

  const toggleRightDrawer = useCallback(() => {
    setPanelState(prev => ({
      ...prev,
      isRightDrawerOpen: !prev.isRightDrawerOpen,
    }));
  }, []);

  const setRightDrawerOpen = useCallback((open: boolean) => {
    setPanelState(prev => ({ ...prev, isRightDrawerOpen: open }));
  }, []);

  const setLeftPanelWidth = useCallback((width: number) => {
    setPanelState(prev => ({ ...prev, leftPanelWidth: Math.max(240, Math.min(480, width)) }));
  }, []);

  const setRightPanelWidth = useCallback((width: number) => {
    setPanelState(prev => ({ ...prev, rightPanelWidth: Math.max(280, Math.min(600, width)) }));
  }, []);

  const toggleCompactMode = useCallback(() => {
    setPanelState(prev => ({ ...prev, compactMode: !prev.compactMode }));
  }, []);

  const toggleBottomBar = useCallback(() => {
    setPanelState(prev => ({ ...prev, bottomBarCollapsed: !prev.bottomBarCollapsed }));
  }, []);

  const resetPanelState = useCallback(() => {
    setPanelState(defaultPanelState);
  }, []);

  return (
    <PanelStateContext.Provider
      value={{
        panelState,
        setActiveLeftPanel,
        toggleLeftPanel,
        setActiveInspectorTab,
        toggleRightDrawer,
        setRightDrawerOpen,
        setLeftPanelWidth,
        setRightPanelWidth,
        toggleCompactMode,
        toggleBottomBar,
        resetPanelState,
      }}
    >
      {children}
    </PanelStateContext.Provider>
  );
};

export const usePanelState = (): PanelStateContextType => {
  const context = useContext(PanelStateContext);
  if (!context) {
    throw new Error('usePanelState must be used within a PanelStateProvider');
  }
  return context;
};
