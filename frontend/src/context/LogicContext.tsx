/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState } from 'react';
import { StateVariable, LogicFlow } from '../utils/schema';

interface LogicContextType {
    variables: StateVariable[];
    addVariable: (variable: Omit<StateVariable, 'id'>) => void;
    updateVariable: (id: string, updates: Partial<StateVariable>) => void;
    removeVariable: (id: string) => void;

    flows: LogicFlow[];
    addFlow: (flow: Omit<LogicFlow, 'id'>) => void;
    updateFlow: (id: string, updates: Partial<LogicFlow>) => void;
    removeFlow: (id: string) => void;
}

const LogicContext = createContext<LogicContextType | undefined>(undefined);

export const LogicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [variables, setVariables] = useState<StateVariable[]>([]);
    const [flows, setFlows] = useState<LogicFlow[]>([]);

    const addVariable = (variable: Omit<StateVariable, 'id'>) => {
        const newVar: StateVariable = {
            ...variable,
            id: `var_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };
        setVariables([...variables, newVar]);
    };

    const updateVariable = (id: string, updates: Partial<StateVariable>) => {
        setVariables(variables.map(v => v.id === id ? { ...v, ...updates } : v));
    };

    const removeVariable = (id: string) => {
        setVariables(variables.filter(v => v.id !== id));
    };

    const addFlow = (flow: Omit<LogicFlow, 'id'>) => {
        const newFlow: LogicFlow = {
            ...flow,
            id: `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };
        setFlows([...flows, newFlow]);
    };

    const updateFlow = (id: string, updates: Partial<LogicFlow>) => {
        setFlows(flows.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    const removeFlow = (id: string) => {
        setFlows(flows.filter(f => f.id !== id));
    };

    return (
        <LogicContext.Provider value={{
            variables, addVariable, updateVariable, removeVariable,
            flows, addFlow, updateFlow, removeFlow
        }}>
            {children}
        </LogicContext.Provider>
    );
};

export const useLogic = () => {
    const context = useContext(LogicContext);
    if (!context) {
        throw new Error('useLogic must be used within a LogicProvider');
    }
    return context;
};
