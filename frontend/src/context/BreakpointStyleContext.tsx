/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * Breakpoint definitions matching GrapesJS device manager
 */
export type BreakpointKey = 'desktop' | 'tablet' | 'mobile';

export interface Breakpoint {
    key: BreakpointKey;
    name: string;
    minWidth: number;
    maxWidth: number | null;
    mediaQuery: string;
}

export const BREAKPOINTS: Record<BreakpointKey, Breakpoint> = {
    desktop: { key: 'desktop', name: 'Desktop', minWidth: 992, maxWidth: null, mediaQuery: '@media (min-width: 992px)' },
    tablet: { key: 'tablet', name: 'Tablet', minWidth: 576, maxWidth: 991, mediaQuery: '@media (min-width: 576px) and (max-width: 991px)' },
    mobile: { key: 'mobile', name: 'Mobile', minWidth: 0, maxWidth: 575, mediaQuery: '@media (max-width: 575px)' },
};

/**
 * Style storage structure for per-breakpoint styles
 */
export interface BreakpointStyles {
    desktop: Record<string, string>;
    tablet: Record<string, string>;
    mobile: Record<string, string>;
}

export interface ComponentBreakpointStyles {
    [componentId: string]: BreakpointStyles;
}

/**
 * Context type for breakpoint style management
 */
interface BreakpointStyleContextType {
    currentBreakpoint: BreakpointKey;
    setCurrentBreakpoint: (bp: BreakpointKey) => void;
    getComponentStyles: (componentId: string, breakpoint?: BreakpointKey) => Record<string, string>;
    setComponentStyles: (componentId: string, styles: Record<string, string>, breakpoint?: BreakpointKey) => void;
    updateComponentStyle: (componentId: string, property: string, value: string, breakpoint?: BreakpointKey) => void;
    removeComponentStyle: (componentId: string, property: string, breakpoint?: BreakpointKey) => void;
    generateResponsiveCSS: (componentId: string, selector: string) => string;
    clearComponentStyles: (componentId: string) => void;
    allStyles: ComponentBreakpointStyles;
}

const BreakpointStyleContext = createContext<BreakpointStyleContextType | undefined>(undefined);

/**
 * Provider component for breakpoint-aware style management
 */
export const BreakpointStyleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentBreakpoint, setCurrentBreakpoint] = useState<BreakpointKey>('desktop');
    const [allStyles, setAllStyles] = useState<ComponentBreakpointStyles>({});

    /**
     * Get styles for a component at a specific breakpoint
     */
    const getComponentStyles = useCallback((componentId: string, breakpoint?: BreakpointKey): Record<string, string> => {
        const bp = breakpoint || currentBreakpoint;
        return allStyles[componentId]?.[bp] || {};
    }, [allStyles, currentBreakpoint]);

    /**
     * Set all styles for a component at a specific breakpoint
     */
    const setComponentStyles = useCallback((componentId: string, styles: Record<string, string>, breakpoint?: BreakpointKey) => {
        const bp = breakpoint || currentBreakpoint;
        setAllStyles(prev => ({
            ...prev,
            [componentId]: {
                ...prev[componentId] || { desktop: {}, tablet: {}, mobile: {} },
                [bp]: styles,
            },
        }));
    }, [currentBreakpoint]);

    /**
     * Update a single style property for a component at a specific breakpoint
     */
    const updateComponentStyle = useCallback((componentId: string, property: string, value: string, breakpoint?: BreakpointKey) => {
        const bp = breakpoint || currentBreakpoint;
        setAllStyles(prev => ({
            ...prev,
            [componentId]: {
                ...prev[componentId] || { desktop: {}, tablet: {}, mobile: {} },
                [bp]: {
                    ...(prev[componentId]?.[bp] || {}),
                    [property]: value,
                },
            },
        }));
    }, [currentBreakpoint]);

    /**
     * Remove a style property for a component at a specific breakpoint
     */
    const removeComponentStyle = useCallback((componentId: string, property: string, breakpoint?: BreakpointKey) => {
        const bp = breakpoint || currentBreakpoint;
        setAllStyles(prev => {
            const componentStyles = prev[componentId];
            if (!componentStyles) return prev;

            const bpStyles = { ...componentStyles[bp] };
            delete bpStyles[property];

            return {
                ...prev,
                [componentId]: {
                    ...componentStyles,
                    [bp]: bpStyles,
                },
            };
        });
    }, [currentBreakpoint]);

    /**
     * Generate CSS string with media queries for a component
     */
    const generateResponsiveCSS = useCallback((componentId: string, selector: string): string => {
        const componentStyles = allStyles[componentId];
        if (!componentStyles) return '';

        const cssLines: string[] = [];

        // Desktop styles (base, no media query needed for mobile-first would be opposite)
        // Using desktop-first approach here
        const desktopStyles = componentStyles.desktop;
        if (Object.keys(desktopStyles).length > 0) {
            const desktopCSS = Object.entries(desktopStyles).map(([prop, val]) => `  ${prop}: ${val};`).join('\n');
            cssLines.push(`${selector} {\n${desktopCSS}\n}`);
        }

        // Tablet styles
        const tabletStyles = componentStyles.tablet;
        if (Object.keys(tabletStyles).length > 0) {
            const tabletCSS = Object.entries(tabletStyles).map(([prop, val]) => `    ${prop}: ${val};`).join('\n');
            cssLines.push(`${BREAKPOINTS.tablet.mediaQuery} {\n  ${selector} {\n${tabletCSS}\n  }\n}`);
        }

        // Mobile styles
        const mobileStyles = componentStyles.mobile;
        if (Object.keys(mobileStyles).length > 0) {
            const mobileCSS = Object.entries(mobileStyles).map(([prop, val]) => `    ${prop}: ${val};`).join('\n');
            cssLines.push(`${BREAKPOINTS.mobile.mediaQuery} {\n  ${selector} {\n${mobileCSS}\n  }\n}`);
        }

        return cssLines.join('\n\n');
    }, [allStyles]);

    /**
     * Clear all styles for a component
     */
    const clearComponentStyles = useCallback((componentId: string) => {
        setAllStyles(prev => {
            const newStyles = { ...prev };
            delete newStyles[componentId];
            return newStyles;
        });
    }, []);

    return (
        <BreakpointStyleContext.Provider
            value={{
                currentBreakpoint,
                setCurrentBreakpoint,
                getComponentStyles,
                setComponentStyles,
                updateComponentStyle,
                removeComponentStyle,
                generateResponsiveCSS,
                clearComponentStyles,
                allStyles,
            }}
        >
            {children}
        </BreakpointStyleContext.Provider>
    );
};

/**
 * Hook to access breakpoint style context
 */
export const useBreakpointStyles = (): BreakpointStyleContextType => {
    const context = useContext(BreakpointStyleContext);
    if (!context) {
        throw new Error('useBreakpointStyles must be used within a BreakpointStyleProvider');
    }
    return context;
};

/**
 * Utility to merge styles with cascade (mobile -> tablet -> desktop)
 */
export const mergeBreakpointStyles = (styles: BreakpointStyles, targetBreakpoint: BreakpointKey): Record<string, string> => {
    // Start with mobile as base, then layer tablet, then desktop
    // This gives us mobile-first cascade
    let merged: Record<string, string> = {};

    // Always include mobile as base
    merged = { ...merged, ...styles.mobile };

    // If tablet or desktop, include tablet
    if (targetBreakpoint === 'tablet' || targetBreakpoint === 'desktop') {
        merged = { ...merged, ...styles.tablet };
    }

    // If desktop, include desktop
    if (targetBreakpoint === 'desktop') {
        merged = { ...merged, ...styles.desktop };
    }

    return merged;
};

export default { BreakpointStyleProvider, useBreakpointStyles, BREAKPOINTS, mergeBreakpointStyles };
