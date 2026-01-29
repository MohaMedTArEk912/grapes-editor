import { LogicFlow } from '../schema';

/**
 * React Builder
 * Converts GrapesJS JSON Component Tree -> React JSX String
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const buildReactPage = (pageName: string, components: any[], flows: LogicFlow[]): string => {
    const pageContent = components.map(c => processComponent(c, flows)).join('\n');

    // We need to check if we use any specific imports? 
    // For now, we assume standard HTML elements.

    return `import React from 'react';
import { useLogic } from '../context/LogicContext';

export const ${pageName} = () => {
    const { executeFlow } = useLogic();

    return (
        <div className="min-h-screen bg-white">
            ${pageContent}
        </div>
    );
};`;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const processComponent = (component: any, flows: LogicFlow[], indentLevel = 3): string => {
    const indent = '    '.repeat(indentLevel);

    // 1. Text Nodes
    if (component.type === 'textnode' || typeof component === 'string') {
        const content = component.content || component;
        return content ? `${content}` : ''; // Don't add newline for pure text
    }

    // 2. Standard Elements
    const tagName = component.tagName || 'div';
    const attributes = { ...component.attributes };

    // GrapesJS uses 'classes' array
    if (component.classes && component.classes.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        attributes.className = component.classes.map((c: any) => c.name || c).join(' ');
    }

    // Handle specific props mapping
    if (attributes.class) {
        attributes.className = attributes.className ? `${attributes.className} ${attributes.class}` : attributes.class;
        delete attributes.class;
    }

    // 3. Logic Injection
    // Check if this component has any flows attached
    const componentId = attributes.id;
    const componentFlows = flows.filter(f => f.componentId === componentId);

    const eventHandlers: string[] = [];

    componentFlows.forEach(flow => {
        // Map event names: 'click' -> 'onClick'
        const reactEvent = getReactEventName(flow.event);
        if (reactEvent) {
            // We pass the flow ID to executeFlow
            eventHandlers.push(`${reactEvent}={(e) => executeFlow('${flow.id}', e)}`);
        }
    });

    // Construct Props String
    const propsString = Object.entries(attributes)
        .map(([key, value]) => {
            if (key === 'id') return `id="${value}"`;
            if (key === 'className') return `className="${value}"`;
            // Add other attribute handling as needed
            return `${key}="${value}"`;
        })
        .concat(eventHandlers)
        .join(' ');

    // 4. Children
    let childrenContent = '';
    if (component.components && component.components.length > 0) {
        childrenContent = component.components
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((child: any) => processComponent(child, flows, indentLevel + 1))
            .join('\n');
    } else if (component.content) {
        childrenContent = component.content;
    }

    // 5. Build JSX
    if (!childrenContent) {
        return `${indent}<${tagName} ${propsString} />`;
    }

    return `${indent}<${tagName} ${propsString}>
${childrenContent}
${indent}</${tagName}>`;
};

const getReactEventName = (grapesEvent: string) => {
    switch (grapesEvent) {
        case 'click': return 'onClick';
        case 'change': return 'onChange';
        case 'load': return 'onLoad'; // Note: div onLoad might not work as expected in all cases, mostly for img/iframe
        case 'input': return 'onInput';
        case 'submit': return 'onSubmit';
        default: return null;
    }
}
