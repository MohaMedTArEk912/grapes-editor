import React from 'react';
import {
  FolderOpen,
  FileStack,
  Box,
  Image,
  CircuitBoard,
  Database,
  Search,
  Cloud,
  BarChart3,
  ShieldCheck,
  Store,
  LayoutTemplate,
  Files,
  Package,
  History,
  Users,
  Code,
  ShoppingBag,
  PanelRight,
} from 'lucide-react';
import { usePanelState, PanelType } from '../../context/PanelStateContext';

interface NavItem {
  id: PanelType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
}

const navItems: NavItem[] = [
  { id: 'project', label: 'Project', icon: FolderOpen, shortcut: 'P' },
  { id: 'pages', label: 'Pages', icon: FileStack, shortcut: 'G' },
  { id: 'blocks', label: 'Blocks', icon: Box, shortcut: 'B' },
  { id: 'files', label: 'Files', icon: Files, shortcut: 'F' },
  { id: 'assets', label: 'Assets', icon: Image, shortcut: 'A' },
  { id: 'logic', label: 'Logic', icon: CircuitBoard, shortcut: 'L' },
  { id: 'data', label: 'Data', icon: Database, shortcut: 'D' },
  { id: 'seo', label: 'SEO', icon: Search, shortcut: 'S' },
  { id: 'publish', label: 'Publish', icon: Cloud, shortcut: 'U' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, shortcut: 'Y' },
  { id: 'accessibility', label: 'A11y', icon: ShieldCheck, shortcut: 'X' },
  { id: 'marketplace', label: 'Market', icon: Store, shortcut: 'M' },
  { id: 'layout', label: 'Layout', icon: LayoutTemplate, shortcut: 'T' },
  { id: 'symbols', label: 'Symbols', icon: Package, shortcut: 'O' },
  { id: 'history', label: 'History', icon: History, shortcut: 'H' },
  { id: 'collab', label: 'Collab', icon: Users, shortcut: 'C' },
  { id: 'code', label: 'Code', icon: Code, shortcut: 'K' },
  { id: 'commerce', label: 'Commerce', icon: ShoppingBag, shortcut: 'E' },
];

export const LeftRail: React.FC = () => {
  const { panelState, toggleLeftPanel, toggleRightDrawer } = usePanelState();

  return (
    <div className="w-16 bg-gray-900 border-r border-gray-800 flex flex-col items-center py-3 gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = panelState.activeLeftPanel === item.id;
        
        return (
          <button
            key={item.id}
            onClick={() => toggleLeftPanel(item.id)}
            title={`${item.label}${item.shortcut ? ` (Ctrl+Shift+${item.shortcut})` : ''}`}
            className={`
              w-12 h-12 rounded-lg flex items-center justify-center
              transition-all duration-150 group relative
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900
              ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }
            `}
            aria-label={item.label}
            aria-pressed={isActive}
          >
            <Icon className="w-5 h-5" />
            
            {/* Tooltip */}
            <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
              {item.label}
              {item.shortcut && (
                <span className="ml-2 text-gray-400">
                  ⌘⇧{item.shortcut}
                </span>
              )}
            </span>
          </button>
        );
      })}
      {/* Right Drawer Toggle */}
      <div className="mt-auto pt-2 border-t border-gray-800">
        <button
          onClick={toggleRightDrawer}
          title={panelState.isRightDrawerOpen ? 'Hide Inspector' : 'Show Inspector'}
          className={`
            w-12 h-12 rounded-lg flex items-center justify-center
            transition-all duration-150 group relative
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900
            ${panelState.isRightDrawerOpen
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }
          `}
          aria-label={panelState.isRightDrawerOpen ? 'Hide Inspector' : 'Show Inspector'}
          aria-pressed={panelState.isRightDrawerOpen}
        >
          <PanelRight className="w-5 h-5" />
          <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
            {panelState.isRightDrawerOpen ? 'Hide Inspector' : 'Show Inspector'}
          </span>
        </button>
      </div>
    </div>
  );
};
