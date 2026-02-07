/**
 * Modal Component - React version
 * 
 * Reusable modal dialog component.
 */

import React, { useEffect } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: "sm" | "md" | "lg" | "xl";
    showCloseButton?: boolean;
}

const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    size = "md",
    showCloseButton = true
}) => {
    const sizeClasses = {
        sm: "max-w-sm",
        md: "max-w-md",
        lg: "max-w-lg",
        xl: "max-w-xl",
    };

    // Handle escape key
    useEffect(() => {
        if (isOpen) {
            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === "Escape") {
                    onClose();
                }
            };
            document.addEventListener("keydown", handleKeyDown);
            return () => document.removeEventListener("keydown", handleKeyDown);
        }
    }, [isOpen, onClose]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = "";
            };
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                <div
                    className={`w-full ${sizeClasses[size]} bg-[#0a0a0b] rounded-[2.5rem] shadow-[0_32px_128px_-12px_rgba(0,0,0,0.8)] border border-white/10 pointer-events-auto animate-slide-up overflow-hidden`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-10 pt-10 pb-6">
                        <h2 className="text-2xl font-black text-white tracking-tight italic uppercase">
                            {title}
                            <span className="text-indigo-500 ml-1">.</span>
                        </h2>
                        {showCloseButton && (
                            <button
                                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white/20 hover:text-white hover:bg-white/5 transition-all"
                                onClick={onClose}
                                aria-label="Close modal"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* Content */}
                    <div className="px-10 pb-10">{children}</div>
                </div>
            </div>
        </>,
        document.body
    );
};

// ConfirmModal - Specialized confirmation dialog
interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "warning" | "info";
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "info"
}) => {
    const variantClasses = {
        danger: "bg-ide-error hover:bg-red-600",
        warning: "bg-yellow-500 hover:bg-yellow-600",
        info: "bg-ide-accent hover:bg-indigo-600",
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
            <div className="text-ide-text-muted mb-6">{message}</div>
            <div className="flex justify-end gap-2">
                <button
                    className="btn-ghost"
                    onClick={onClose}
                >
                    {cancelText}
                </button>
                <button
                    className={`px-4 py-2 rounded-lg text-white font-medium transition-colors ${variantClasses[variant]}`}
                    onClick={() => {
                        onConfirm();
                        onClose();
                    }}
                >
                    {confirmText}
                </button>
            </div>
        </Modal>
    );
};

// Toast Component - For notifications
interface ToastProps {
    message: string;
    type: "success" | "error" | "warning" | "info";
    onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onDismiss }) => {
    const typeStyles = {
        success: "bg-ide-success text-white",
        error: "bg-ide-error text-white",
        warning: "bg-yellow-500 text-black",
        info: "bg-ide-accent text-white",
    };

    const typeIcons = {
        success: "M5 13l4 4L19 7",
        error: "M6 18L18 6M6 6l12 12",
        warning: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
        info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    };

    // Auto-dismiss after 4 seconds
    useEffect(() => {
        const timer = setTimeout(onDismiss, 4000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    return createPortal(
        <div className="fixed bottom-4 right-4 z-50 animate-slide-in-right">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl ${typeStyles[type]}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={typeIcons[type]} />
                </svg>
                <span className="font-medium">{message}</span>
                <button
                    className="ml-2 p-1 hover:bg-white/20 rounded transition-colors"
                    onClick={onDismiss}
                    aria-label="Dismiss"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>,
        document.body
    );
};

export default Modal;
