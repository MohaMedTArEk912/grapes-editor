import React, { ReactNode } from 'react';
import { X } from 'lucide-react';
import { usePanelState } from '../../context/PanelStateContext';

interface LeftPanelProps {
  children: ReactNode;
  title: string;
  onClose?: () => void;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({ children, title, onClose }) => {
  const { panelState, setActiveLeftPanel } = usePanelState();

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setActiveLeftPanel(null);
    }
  };

  return (
    <div
      className="h-full bg-gray-900 border-r border-gray-800 flex flex-col"
      style={{ width: `${panelState.leftPanelWidth}px` }}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-white p-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
};
