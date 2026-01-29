import { LogicFlow, StateVariable } from '../schema';

/**
 * Logic Generator
 * Generates the LogicContext.tsx file content for the exported app
 */

export const generateLogicContext = (variables: StateVariable[], flows: LogicFlow[]): string => {
    // 1. Generate State Definitions
    const stateDefinitions = variables.map(v => {
        const defaultVal = v.type === 'string' ? `'${v.defaultValue}'` : v.defaultValue;
        return `    const [${v.name}, set_${v.id}] = useState<${v.type}>(${defaultVal});`;
    }).join('\n');

    // 2. Generate Context Value Map (id -> state)
    // We Map internal variable IDs to the actual state variables
    const variableMap = variables.map(v => `        '${v.id}': { value: ${v.name}, set: set_${v.id} },`).join('\n');

    // 3. Generate Flow Execution Logic
    // We hardcode the executeAction logic but make it use the variableMap
    const flowDefinitions = `
    const flows = ${JSON.stringify(flows, null, 4)};

    const executeFlow = async (flowId: string, event: React.SyntheticEvent) => {
        const flow = flows.find(f => f.id === flowId);
        if (!flow) return;

        console.log('Executing Flow:', flow.name);

        for (const action of flow.actions) {
            await executeAction(action, event);
        }
    };

    const executeAction = async (action: any, event: React.SyntheticEvent) => {
        switch (action.type) {
            case 'alert':
                alert(action.params.message);
                break;
            case 'navigate':
                if (action.params.url) window.open(action.params.url, '_blank');
                break;
            case 'set-variable':
                if (action.params.variableId) {
                    const variable = variableMap[action.params.variableId];
                    if (variable) {
                        // TODO: Support dynamic expressions (current value + 1)
                        // For now we just support raw values
                        variable.set(action.params.value);
                    }
                }
                break;
            case 'toggle-class':
                 if (action.params.className && event.currentTarget) {
                     event.currentTarget.classList.toggle(action.params.className);
                 }
                 break;
        }
    };
    `;

    // 4. Build Final File Content
    return `import React, { createContext, useContext, useState } from 'react';

interface LogicContextType {
    executeFlow: (flowId: string, event: React.SyntheticEvent) => void;
    variables: Record<string, any>; // Expose raw values if needed
}

const LogicContext = createContext<LogicContextType | undefined>(undefined);

export const useLogic = () => {
    const context = useContext(LogicContext);
    if (!context) throw new Error('useLogic must be used within LogicProvider');
    return context;
};

export const LogicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
${stateDefinitions}

    const variableMap: Record<string, { value: any, set: React.Dispatch<any> }> = {
${variableMap}
    };

${flowDefinitions}

    // Expose variables by name for easier debugging/usage if needed
    const exposedVariables = {
        ${variables.map(v => `${v.name}: ${v.name}`).join(',\n        ')}
    };

    return (
        <LogicContext.Provider value={{ executeFlow, variables: exposedVariables }}>
            {children}
        </LogicContext.Provider>
    );
};
`;
};
