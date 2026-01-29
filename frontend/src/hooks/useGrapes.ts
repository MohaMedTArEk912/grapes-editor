import { useEffect, useRef, useState } from 'react';
import grapesjs from 'grapesjs';
import { initBlocks } from '../utils/blocks';
import { GrapesEditor } from '../types/grapes';



export const useGrapes = () => {
    const [editor, setEditor] = useState<GrapesEditor | null>(null);
    const editorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!editorRef.current) return;

        const editorInstance = grapesjs.init({
            container: editorRef.current,
            height: '100%',
            width: 'auto',
            fromElement: true,
            storageManager: {
                type: 'local',
                id: 'gjs-ultimate-',
                autosave: true,
                autoload: true,
                stepsBeforeSave: 1,
            },
            deviceManager: {
                devices: [
                    { name: 'Desktop', width: '' },
                    { name: 'Tablet', width: '768px', widthMedia: '992px' },
                    { name: 'Mobile portrait', width: '320px', widthMedia: '575px' },
                ]
            },
            panels: { defaults: [] },
            blockManager: {
                appendTo: '#blocks-container',
            },
            layerManager: {
                appendTo: '#layers-container',
            },
            selectorManager: {
                appendTo: '#selectors-container',
            },
            styleManager: {
                appendTo: '#styles-container',
                sectors: [
                    {
                        name: 'General',
                        open: false,
                        buildProps: ['float', 'display', 'position', 'top', 'right', 'left', 'bottom'],
                    },
                    {
                        name: 'Flex',
                        open: false,
                        buildProps: [
                            'flex-direction', 'flex-wrap', 'justify-content', 'align-items',
                            'align-content', 'order', 'flex-basis', 'flex-grow', 'flex-shrink', 'align-self'
                        ],
                    },
                    {
                        name: 'Dimension',
                        open: false,
                        buildProps: ['width', 'height', 'max-width', 'min-width', 'max-height', 'min-height', 'margin', 'padding'],
                    },
                    {
                        name: 'Typography',
                        open: false,
                        buildProps: [
                            'font-family', 'font-size', 'font-weight', 'letter-spacing',
                            'color', 'line-height', 'text-align', 'text-decoration',
                            'text-transform', 'text-shadow'
                        ],
                    },
                    {
                        name: 'Decorations',
                        open: false,
                        buildProps: [
                            'opacity', 'background', 'background-color', 'border',
                            'border-radius', 'box-shadow'
                        ],
                    },
                    {
                        name: 'Extra',
                        open: false,
                        buildProps: ['transition', 'transform', 'cursor', 'overflow'],
                    },
                ],
            },
            traitManager: {
                appendTo: '#traits-container',
            },
            canvas: {
                styles: [
                    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
                    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
                ],
            },
        });
        // Manually Register 'preview' command to ensure we have a 'real' preview
        editorInstance.Commands.add('preview', {
            run: (editor: GrapesEditor) => {
                // 1. Stop core editing helpers
                try { editor.stopCommand('sw-visibility'); } catch (e) { console.warn(e) }
                try { editor.stopCommand('core:component-outline'); } catch (e) { /* ignore */ }
                try { editor.stopCommand('core:canvas-tooltips'); } catch (e) { /* ignore */ }

                // 2. Clear selection
                editor.select(undefined);

                // 3. Manually clean up any lingering CSS classes for a "Real" preview
                const canvasBody = editor.Canvas.getBody();
                if (canvasBody) {
                    canvasBody.classList.remove('gjs-dashed');
                    // Add a class that we can target with CSS to hide other editor-specific elements if needed
                    canvasBody.classList.add('gjs-preview-active');
                }

                // 4. Notify UI
                editor.trigger('run:preview');
            },
            stop: (editor: GrapesEditor) => {
                // 1. Remove preview class explicitly
                const canvasBody = editor.Canvas.getBody();
                if (canvasBody) {
                    canvasBody.classList.remove('gjs-preview-active');
                    // Forcefully add the class back if sw-visibility fails to do so immediately
                    canvasBody.classList.add('gjs-dashed');
                }

                // 2. Restore core editing helpers
                // Force stop then start to ensure it resets the internal state correctly
                try { editor.stopCommand('sw-visibility'); } catch (e) { /* ignore */ }
                try { editor.runCommand('sw-visibility'); } catch (e) { /* ignore */ }

                try { editor.runCommand('core:component-outline'); } catch (e) { /* ignore */ }
                try { editor.runCommand('core:canvas-tooltips'); } catch (e) { /* ignore */ }

                // 3. Notify UI
                editor.trigger('stop:preview');
            }
        });

        initBlocks(editorInstance);
        setEditor(editorInstance);

        return () => {
            editorInstance.destroy();
        };
    }, []);

    return { editor, editorRef };
};
