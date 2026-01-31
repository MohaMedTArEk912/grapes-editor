import { useEffect, useRef, useState } from 'react';
import grapesjs from 'grapesjs';
// @ts-ignore - No types available for this plugin
import grapesjsTailwind from 'grapesjs-tailwind';
// @ts-ignore - No types available for this plugin
import grapesjsRulers from 'grapesjs-rulers';
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
            // Enable free-form absolute positioning validation
            dragMode: 'absolute',
            // Tailwind-first: All styling uses Tailwind CSS classes
            plugins: [grapesjsTailwind, grapesjsRulers],
            pluginsOpts: {
                // grapesjs-tailwind plugin options
                'grapesjs-tailwind': {
                    // Disable plugin's blocks - we use our own responsive blocks
                    blocks: [],
                    // Use local play script to avoid "CDN in production" warnings
                    tailwindPlayCdn: '/tailwind-play.js',
                },
                'grapesjs-rulers': {
                    dragMode: 'translate',
                }
            },
            storageManager: {
                type: 'local',
                id: 'gjs-ultimate-',
                autosave: true,
                autoload: false, // Always start with clean canvas
                stepsBeforeSave: 1,
            },
            deviceManager: {
                devices: [
                    { name: 'Desktop', width: '' }, // Full width, lg: breakpoint (>=1024px)
                    { name: 'Tablet', width: '768px', widthMedia: '768px' }, // md: breakpoint
                    { name: 'Mobile portrait', width: '375px', widthMedia: '640px' }, // Below sm: breakpoint
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
                    // Local Tailwind build for canvas styling (served by Vite)
                    '/src/styles/index.css',
                ],
                scripts: [
                    // Use local Tailwind Play for JIT in canvas
                    '/tailwind-play.js',
                ],
                // Ensure the canvas frame has proper styling for responsive preview
                frameStyle: `
                    html {
                        height: 100%;
                        width: 100%;
                    }
                    body { 
                        background-color: #ffffff !important; 
                        margin: 0;
                        padding: 0;
                        min-height: 100vh !important;
                        height: 100%;
                        width: 100%;
                        overflow-x: hidden;
                    }
                    * { 
                        box-sizing: border-box; 
                    }
                    img, video, iframe, embed, object {
                        max-width: 100%;
                        height: auto;
                    }
                    section, div, article, aside, header, footer, nav, main {
                        max-width: 100%;
                    }
                `,
            },
        });


        initBlocks(editorInstance);

        // Cleanup unwanted blocks injected by plugins
        // We use a whitelist approach to only keep our custom blocks
        const allowedBlocks = new Set([
            'section', 'text', 'image', 'video', 'map', 'link', 'link-block',
            'column1', 'column2', 'column3', 'column37',
            'button', 'divider', 'quote',
            'product-card', 'hero', 'card', 'testimonial', 'pricing', 'navbar', 'footer',
            'form', 'input', 'textarea', 'select', 'checkbox', 'radio'
        ]);

        const bm = editorInstance.BlockManager;
        const allBlocks = bm.getAll();
        const blocksToRemove = allBlocks.filter((block: any) => !allowedBlocks.has(block.getId()));

        blocksToRemove.forEach((block: any) => bm.remove(block.getId()));
        setEditor(editorInstance);

        return () => {
            editorInstance.destroy();
        };
    }, []);

    return { editor, editorRef };
};
