import { useEffect, useRef, useState } from 'react';
import grapesjs, { Editor } from 'grapesjs';
import { initBlocks } from '../utils/blocks';

export const useGrapes = () => {
    const [editor, setEditor] = useState<Editor | null>(null);
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

        initBlocks(editorInstance);
        setEditor(editorInstance);

        return () => {
            editorInstance.destroy();
        };
    }, []);

    return { editor, editorRef };
};
