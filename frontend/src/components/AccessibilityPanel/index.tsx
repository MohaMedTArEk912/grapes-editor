import React, { useMemo } from 'react';
import { ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';
import { GrapesEditor } from '../../types/grapes';

interface AccessibilityPanelProps {
    editor: GrapesEditor | null;
}

export const AccessibilityPanel: React.FC<AccessibilityPanelProps> = ({ editor }) => {
    const report = useMemo(() => {
        if (!editor) return null;
        const html = editor.getHtml() || '';
        const css = editor.getCss() || '';
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const issues: Array<{ type: string; message: string; severity: 'low' | 'medium' | 'high' }> = [];

        const images = Array.from(doc.querySelectorAll('img'));
        const missingAlt = images.filter((img) => !img.hasAttribute('alt') || img.getAttribute('alt')?.trim() === '');
        if (missingAlt.length) {
            issues.push({ type: 'alt', message: `${missingAlt.length} images missing alt text`, severity: 'high' });
        }

        const inputs = Array.from(doc.querySelectorAll('input, textarea, select')) as HTMLElement[];
        const missingLabels = inputs.filter((input) => {
            const id = input.getAttribute('id');
            const hasLabel = id ? doc.querySelector(`label[for="${id}"]`) : null;
            const ariaLabel = input.getAttribute('aria-label');
            const ariaLabelledBy = input.getAttribute('aria-labelledby');
            return !hasLabel && !ariaLabel && !ariaLabelledBy;
        });
        if (missingLabels.length) {
            issues.push({ type: 'labels', message: `${missingLabels.length} form fields missing labels`, severity: 'high' });
        }

        const buttons = Array.from(doc.querySelectorAll('button, [role="button"]')) as HTMLElement[];
        const emptyButtons = buttons.filter((button) => !button.textContent?.trim() && !button.getAttribute('aria-label'));
        if (emptyButtons.length) {
            issues.push({ type: 'buttons', message: `${emptyButtons.length} buttons lack accessible text`, severity: 'medium' });
        }

        const links = Array.from(doc.querySelectorAll('a')) as HTMLElement[];
        const emptyLinks = links.filter((link) => !link.textContent?.trim() && !link.getAttribute('aria-label'));
        if (emptyLinks.length) {
            issues.push({ type: 'links', message: `${emptyLinks.length} links lack accessible text`, severity: 'medium' });
        }

        const interactive = Array.from(doc.querySelectorAll('[onclick]')) as HTMLElement[];
        const nonFocusable = interactive.filter((el) => {
            const tag = el.tagName.toLowerCase();
            const tabindex = el.getAttribute('tabindex');
            const isFocusable = ['button', 'a', 'input', 'select', 'textarea'].includes(tag) || tabindex !== null;
            return !isFocusable;
        });
        if (nonFocusable.length) {
            issues.push({ type: 'keyboard', message: `${nonFocusable.length} clickable elements not focusable`, severity: 'high' });
        }

        const contrastIssues: string[] = [];
        const colorMap: Record<string, [number, number, number]> = {
            'text-black': [0, 0, 0],
            'text-white': [255, 255, 255],
            'bg-white': [255, 255, 255],
            'bg-black': [0, 0, 0],
            'text-slate-900': [15, 23, 42],
            'bg-slate-900': [15, 23, 42],
            'text-slate-800': [30, 41, 59],
            'bg-slate-800': [30, 41, 59],
            'text-slate-700': [51, 65, 85],
            'bg-slate-700': [51, 65, 85],
            'text-slate-600': [71, 85, 105],
            'bg-slate-600': [71, 85, 105],
            'text-gray-900': [17, 24, 39],
            'bg-gray-900': [17, 24, 39],
            'text-gray-700': [55, 65, 81],
            'bg-gray-700': [55, 65, 81],
            'text-indigo-600': [79, 70, 229],
            'bg-indigo-600': [79, 70, 229],
            'text-emerald-600': [5, 150, 105],
            'bg-emerald-600': [5, 150, 105],
        };

        const parseRgb = (value: string | null) => {
            if (!value) return null;
            const match = value.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/i);
            if (match) return [Number(match[1]), Number(match[2]), Number(match[3])] as [number, number, number];
            return null;
        };

        const luminance = (rgb: [number, number, number]) => {
            const channel = (c: number) => {
                const v = c / 255;
                return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
            };
            return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
        };

        const contrastRatio = (fg: [number, number, number], bg: [number, number, number]) => {
            const l1 = luminance(fg) + 0.05;
            const l2 = luminance(bg) + 0.05;
            return l1 > l2 ? l1 / l2 : l2 / l1;
        };

        const textElements = Array.from(doc.querySelectorAll('*')) as HTMLElement[];
        textElements.forEach((element) => {
            if (!element.textContent?.trim()) return;
            const style = element.getAttribute('style') || '';
            const inlineColor = parseRgb(style.match(/color:\s*([^;]+)/)?.[1] || null);
            const inlineBg = parseRgb(style.match(/background-color:\s*([^;]+)/)?.[1] || null);
            const classList = element.className?.split(' ') || [];
            const classColor = classList.map((cls) => colorMap[`text-${cls.replace('text-', '')}`] || colorMap[cls]).find(Boolean) as [number, number, number] | undefined;
            const classBg = classList.map((cls) => colorMap[`bg-${cls.replace('bg-', '')}`] || colorMap[cls]).find(Boolean) as [number, number, number] | undefined;
            const fg = inlineColor || classColor;
            const bg = inlineBg || classBg;
            if (fg && bg) {
                const ratio = contrastRatio(fg, bg);
                if (ratio < 4.5) {
                    contrastIssues.push(`${element.tagName.toLowerCase()} contrast ${ratio.toFixed(2)}:1`);
                }
            }
        });

        if (contrastIssues.length) {
            issues.push({ type: 'contrast', message: `${contrastIssues.length} text elements with low contrast`, severity: 'medium' });
        }

        const score = Math.max(0, 100 - issues.reduce((sum, issue) => sum + (issue.severity === 'high' ? 15 : issue.severity === 'medium' ? 10 : 5), 0));

        return {
            totalImages: images.length,
            missingAlt: missingAlt.length,
            contrastIssues: contrastIssues.length,
            keyboardIssues: nonFocusable.length,
            labelIssues: missingLabels.length,
            issues,
            score,
            css,
        };
    }, [editor]);

    if (!editor) {
        return <div className="p-4 text-slate-400 text-sm">Editor not ready.</div>;
    }

    return (
        <div className="p-4 text-slate-200">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <ShieldAlert size={18} />
                    Accessibility
                </h3>
                {report?.score === 100 ? (
                    <CheckCircle2 size={16} className="text-green-400" />
                ) : (
                    <span className="text-xs text-slate-400">Score {report?.score}</span>
                )}
            </div>

            {report && (
                <div className="space-y-3 text-sm text-slate-300">
                    <div>Total images: {report.totalImages}</div>
                    <div>Missing alt text: {report.missingAlt}</div>
                    <div>Missing labels: {report.labelIssues}</div>
                    <div>Contrast issues: {report.contrastIssues}</div>
                    <div>Keyboard issues: {report.keyboardIssues}</div>
                    <div className="text-xs text-slate-500">WCAG checks include contrast, labels, and keyboard navigation.</div>

                    {report.issues.length === 0 ? (
                        <div className="text-xs text-emerald-300 flex items-center gap-2">
                            <CheckCircle2 size={14} />
                            No critical accessibility issues found.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {report.issues.map((issue, index) => (
                                <div
                                    key={`${issue.type}-${index}`}
                                    className="text-xs text-amber-200 flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded p-2"
                                >
                                    <AlertTriangle size={12} />
                                    <span>{issue.message}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
