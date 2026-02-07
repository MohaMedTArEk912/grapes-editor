import React from "react";

interface WindowControlsProps {
    className?: string;
}

const WindowControls: React.FC<WindowControlsProps> = ({ className = "" }) => {
    const handleMinimizeWindow = async () => {
        try {
            const { getCurrentWindow } = await import("@tauri-apps/api/window");
            await getCurrentWindow().minimize();
        } catch (err) {
            console.error("Failed to minimize window:", err);
        }
    };

    const handleToggleMaximizeWindow = async () => {
        try {
            const { getCurrentWindow } = await import("@tauri-apps/api/window");
            await getCurrentWindow().toggleMaximize();
        } catch (err) {
            console.error("Failed to toggle maximize:", err);
        }
    };

    const handleCloseWindow = async () => {
        try {
            const { getCurrentWindow } = await import("@tauri-apps/api/window");
            await getCurrentWindow().close();
        } catch (err) {
            console.error("Failed to close window via Tauri API:", err);
            window.close();
        }
    };

    return (
        <div className={`flex items-center overflow-hidden rounded-md border border-[var(--ide-border)] bg-[var(--ide-bg-elevated)] ${className}`}>
            <button
                onClick={() => { void handleMinimizeWindow(); }}
                className="w-8 h-7 flex items-center justify-center text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-bg-panel)] transition-colors"
                title="Minimize"
                aria-label="Minimize window"
            >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14" />
                </svg>
            </button>
            <button
                onClick={() => { void handleToggleMaximizeWindow(); }}
                className="w-8 h-7 flex items-center justify-center text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-bg-panel)] transition-colors border-x border-[var(--ide-border)]"
                title="Maximize / Restore"
                aria-label="Maximize or restore window"
            >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="5" y="5" width="14" height="14" rx="1" strokeWidth="2" />
                </svg>
            </button>
            <button
                onClick={() => { void handleCloseWindow(); }}
                className="w-8 h-7 flex items-center justify-center text-[#ffb1b1] hover:text-white hover:bg-[#c42b1c] transition-colors"
                title="Close"
                aria-label="Close window"
            >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 6l12 12M6 18L18 6" />
                </svg>
            </button>
        </div>
    );
};

export default WindowControls;
