import React, { useState } from "react";
import { CraftFrame } from "../craft/CraftFrame";
import LeftSidebar from "../panels/LeftSidebar";
import RightInspectorRail from "../panels/RightInspectorRail";
import type { BuilderLeftTab } from "../hooks/panels/types";

interface BuilderWorkspaceProps {
    onExportClick: () => void;
    onBack?: () => void;
}

const BuilderWorkspace: React.FC<BuilderWorkspaceProps> = ({ onExportClick, onBack }) => {
    const [leftTab, setLeftTab] = useState<BuilderLeftTab>("pages");
    const [inspectorOpen, setInspectorOpen] = useState(true);

    return (
        <div className="flex-1 flex overflow-hidden">
            <LeftSidebar tab={leftTab} onTabChange={setLeftTab} onExportClick={onExportClick} onBack={onBack} />

            <div className="flex-1 overflow-hidden">
                <CraftFrame />
            </div>

            <RightInspectorRail
                open={inspectorOpen}
                onOpen={() => setInspectorOpen(true)}
                onClose={() => setInspectorOpen(false)}
            />
        </div>
    );
};

export default BuilderWorkspace;
