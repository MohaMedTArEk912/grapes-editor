import { createContext, createSignal, useContext, ParentComponent, For, Show } from "solid-js";
import { Portal } from "solid-js/web";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextProps {
    showToast: (message: string, type: ToastType) => void;
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
    warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextProps>();

export const ToastProvider: ParentComponent = (props) => {
    const [toasts, setToasts] = createSignal<Toast[]>([]);

    const removeToast = (id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    const showToast = (message: string, type: ToastType) => {
        const id = Math.random().toString(36).substr(2, 9);
        const toast = { id, message, type };
        setToasts((prev) => [...prev, toast]);
        setTimeout(() => removeToast(id), 4000);
    };

    const success = (message: string) => showToast(message, "success");
    const error = (message: string) => showToast(message, "error");
    const info = (message: string) => showToast(message, "info");
    const warning = (message: string) => showToast(message, "warning");

    const getIcon = (type: ToastType) => {
        switch (type) {
            case "success":
                return (
                    <div class="h-6 w-6 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                    </div>
                );
            case "error":
                return (
                    <div class="h-6 w-6 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </div>
                );
            case "warning":
                return (
                    <div class="h-6 w-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                );
            default:
                return (
                    <div class="h-6 w-6 rounded-full bg-indigo-500/20 text-indigo-500 flex items-center justify-center">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                );
        }
    };

    return (
        <ToastContext.Provider value={{ showToast, success, error, info, warning }}>
            {props.children}
            <Portal>
                <div class="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
                    <For each={toasts()}>
                        {(toast) => (
                            <div class="animate-slide-up pointer-events-auto min-w-[300px] max-w-sm bg-[#1e1e2e] border border-white/5 shadow-2xl rounded-xl p-3 flex items-center gap-3 backdrop-blur-md">
                                {getIcon(toast.type)}
                                <p class="text-sm font-medium text-white/90">{toast.message}</p>
                                <button class="ml-auto text-white/40 hover:text-white" onClick={() => removeToast(toast.id)}>
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        )}
                    </For>
                </div>
            </Portal>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
};
