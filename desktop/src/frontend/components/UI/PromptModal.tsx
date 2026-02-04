import React, { useState, useEffect } from "react";
import Modal from "./Modal";

export interface PromptField {
    name: string;
    label: string;
    placeholder?: string;
    value?: string;
    required?: boolean;
    type?: "text" | "email" | "number" | "url" | "password";
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
                initial[field.name] = field.value ?? "";
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
            <div className="space-y-4">
                {fields.map((field) => (
                    <div key={field.name}>
                        <label className="block text-xs font-semibold text-ide-text-muted mb-1">
                            {field.label}
                            {field.required && (
                                <span className="text-ide-error ml-1">*</span>
                            )}
                        </label>
                        <input
                            type={field.type || "text"}
                            className="input w-full"
                            placeholder={field.placeholder}
                            value={values[field.name] || ""}
                            onChange={(e) => updateValue(field.name, e.target.value)}
                        />
                        {field.helperText && (
                            <p className="text-[11px] text-ide-text-muted mt-1">{field.helperText}</p>
                        )}
                    </div>
                ))}
            </div>

            <div className="flex justify-end gap-2 mt-6">
                <button className="btn-ghost" onClick={onClose} disabled={isSubmitting}>
                    {cancelText}
                </button>
                <button
                    className="px-4 py-2 rounded-lg text-white font-medium bg-ide-accent hover:bg-ide-accent-hover transition-colors disabled:opacity-60"
                    disabled={!canSubmit || isSubmitting}
                    onClick={handleSubmit}
                >
                    {confirmText}
                </button>
            </div>
        </Modal>
    );
};

export default PromptModal;
