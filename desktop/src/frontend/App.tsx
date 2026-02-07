/**
 * Grapes IDE - Main Application - React version
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
import Terminal from "./components/Terminal/Terminal";
import DashboardView from "./components/Dashboard/DashboardView";
import WorkspaceSetup from "./components/Dashboard/WorkspaceSetup";

// Stores
import { initWorkspace } from "./stores/projectStore";
// Hooks
import { useProjectStore } from "./hooks/useProjectStore";
// Context
import { ToastProvider } from "./context/ToastContext";
import { ThemeProvider } from "./context/ThemeContext";

const App: React.FC = () => {
  const { activeTab, project, workspacePath, isDashboardActive } = useProjectStore();

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
      <ThemeProvider>
        <ToastProvider>
          <WorkspaceSetup />
        </ToastProvider>
      </ThemeProvider>
    );
  }

  if (isDashboardActive || !project) {
    return (
      <ThemeProvider>
        <ToastProvider>
          <DashboardView />
        </ToastProvider>
      </ThemeProvider>
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
      case "canvas":
      default:
        return <Canvas />;
    }
  };

  return (
    <ThemeProvider>
      <ToastProvider>
        <IDELayout
          toolbar={<Toolbar />}
          fileTree={<FileTree />}
          canvas={renderCanvas()}
          terminal={<Terminal />}
        />
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
