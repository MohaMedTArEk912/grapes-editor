/**
 * Akasha — Main Application - React version
 * 
 * Desktop-First Visual Full-Stack IDE
 */

import React, { useEffect } from "react";
import "./index.css";

// Components
import IDELayout from "./components/Layout/IDELayout";
import Toolbar from "./components/Toolbar/Toolbar";
import FileTree from "./components/FileTree/FileTree";
import Canvas from "./components/Canvas/Canvas";
import LogicCanvas from "./components/Canvas/LogicCanvas";
import ERDCanvas from "./components/Canvas/ERDCanvas";
import ApiList from "./components/Canvas/ApiList";
import VariablesPanel from "./components/Editors/VariablesPanel";
import Terminal from "./components/Terminal/Terminal";
import DashboardView from "./components/Dashboard/DashboardView";
import WorkspaceSetup from "./components/Dashboard/WorkspaceSetup";
import ErrorBoundary from "./components/UI/ErrorBoundary";

// Stores
import { initWorkspace } from "./stores/projectStore";
// Hooks
import { useProjectStore } from "./hooks/useProjectStore";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
// Context
import { ToastProvider } from "./context/ToastContext";
import { ThemeProvider } from "./context/ThemeContext";
import { DragDropProvider } from "./context/DragDropContext";

const App: React.FC = () => {
  const { activeTab, project, workspacePath, isDashboardActive } = useProjectStore();
  useKeyboardShortcuts();

  // Initialize workspace and try to load any existing project on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        await initWorkspace();
        // Optionially load project if needed, but dashboard usually handles this now
      } catch (err) {
        console.error("Initialization failed:", err);
      }
    };
    initialize();
  }, []);

  // Main navigation logic
  if (!workspacePath) {
    return (
      <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <WorkspaceSetup />
        </ToastProvider>
      </ThemeProvider>
      </ErrorBoundary>
    );
  }

  if (isDashboardActive || !project) {
    return (
      <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <DashboardView />
        </ToastProvider>
      </ThemeProvider>
      </ErrorBoundary>
    );
  }

  // Render the appropriate canvas based on active tab
  const renderCanvas = () => {
    switch (activeTab) {
      case "logic":
        return <LogicCanvas />;
      case "api":
        return <ApiList />;
      case "erd":
        return <ERDCanvas />;
      case "variables":
        return <VariablesPanel />;
      case "canvas":
      default:
        return <Canvas />;
    }
  };

  return (
    <ErrorBoundary>
    <ThemeProvider>
      <ToastProvider>
        <DragDropProvider>
          <IDELayout
            toolbar={<Toolbar />}
            fileTree={<FileTree />}
            canvas={renderCanvas()}
            terminal={<Terminal />}
          />
        </DragDropProvider>
      </ToastProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
