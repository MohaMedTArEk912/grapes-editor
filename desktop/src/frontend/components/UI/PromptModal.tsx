import React, { useState, useEffect } from "react";
import Modal from "./Modal";

export interface PromptField {
    name: string;
    label: string;
    placeholder?: string;
    value?: string;
    required?: boolean;
    type?: "text" | "email" | "number" | "url" | "password" | "select";
    options?: { label: string; value: string }[];
    helperText?: string;
}

interface PromptModalProps {
    isOpen: boolean;
    title: string;
    fields: PromptField[];
    confirmText?: string;
    cancelText?: string;
    onClose: () => void;
    onSubmit: (values: Record<string, string>) => Promise<void> | void;
}

const PromptModal: React.FC<PromptModalProps> = ({
    isOpen,
    title,
    fields,
    confirmText = "Confirm",
    cancelText = "Cancel",
    onClose,
    onSubmit
}) => {
    const [values, setValues] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const initial: Record<string, string> = {};
            for (const field of fields) {
                initial[field.name] = field.value ?? (field.type === 'select' ? field.options?.[0]?.value ?? '' : "");
            }
            setValues(initial);
        }
    }, [isOpen, fields]);

    const updateValue = (name: string, value: string) => {
        setValues((prev) => ({ ...prev, [name]: value }));
    };

    const canSubmit = fields.every(
        (field) => !field.required || (values[field.name] || "").trim().length > 0
    );

    const handleSubmit = async () => {
        if (!canSubmit || isSubmitting) return;
        try {
            setIsSubmitting(true);
            await onSubmit(values);
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
            <div className="space-y-6">
                {fields.map((field) => (
                    <div key={field.name} className="animate-fade-in" style={{ animationDelay: '50ms' }}>
                        <div className="flex items-center justify-between mb-2 px-1">
                            <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                                {field.label}
                                {field.required && (
                                    <span className="text-red-500/50 ml-1">*</span>
                                )}
                            </label>
                        </div>
                        {field.type === "select" ? (
                            <div className="relative group">
                                <select
                                    className="input-modern w-full"
                                    value={values[field.name] || ""}
                                    onChange={(e) => updateValue(field.name, e.target.value)}
                                >
                                    {field.options?.map((opt) => (
                                        <option key={opt.value} value={opt.value} className="bg-[#0a0a0a] text-white">
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <input
                                type={field.type || "text"}
                                className="input-modern w-full"
                                placeholder={field.placeholder}
                                value={values[field.name] || ""}
                                onChange={(e) => updateValue(field.name, e.target.value)}
                            />
                        )}
                        {field.helperText && (
                            <p className="text-[10px] text-white/20 mt-2 ml-1 italic">{field.helperText}</p>
                        )}
                    </div>
                ))}
            </div>

            <div className="flex gap-3 mt-10">
                <button
                    className="flex-1 h-12 rounded-2xl border border-white/5 text-white/40 font-black text-[10px] uppercase tracking-widest hover:bg-white/5 hover:text-white transition-all"
                    onClick={onClose}
                    disabled={isSubmitting}
                >
                    {cancelText}
                </button>
                <button
                    className="flex-1 h-12 rounded-2xl bg-white text-black font-black text-[10px] uppercase tracking-widest hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-20 shadow-xl shadow-white/5"
                    disabled={!canSubmit || isSubmitting}
                    onClick={handleSubmit}
                >
                    {isSubmitting ? "Processing..." : confirmText}
                </button>
            </div>
        </Modal>
    );
};

export default PromptModal;
