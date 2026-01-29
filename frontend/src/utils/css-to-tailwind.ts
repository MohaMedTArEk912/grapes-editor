/**
 * CSS to Tailwind Converter
 * Converts inline CSS styles to Tailwind CSS classes
 * Supports common CSS properties with intelligent mapping
 */

type CSSProperty = string;
type CSSValue = string;
type TailwindClass = string;

interface ConversionResult {
    classes: string[];
    unconverted: Record<string, string>;
}

// Color mappings (common colors to Tailwind)
const colorMap: Record<string, string> = {
    '#000': 'black', '#000000': 'black', 'black': 'black',
    '#fff': 'white', '#ffffff': 'white', 'white': 'white',
    'transparent': 'transparent',
    '#f00': 'red-500', '#ff0000': 'red-500', 'red': 'red-500',
    '#0f0': 'green-500', '#00ff00': 'green-500', 'green': 'green-500',
    '#00f': 'blue-500', '#0000ff': 'blue-500', 'blue': 'blue-500',
    '#ff0': 'yellow-500', '#ffff00': 'yellow-500', 'yellow': 'yellow-500',
    '#f0f': 'fuchsia-500', 'magenta': 'fuchsia-500',
    '#0ff': 'cyan-500', 'cyan': 'cyan-500',
    'gray': 'gray-500', 'grey': 'gray-500',
};

// Spacing scale (px to Tailwind spacing)
const spacingScale: Record<number, string> = {
    0: '0', 1: 'px', 2: '0.5', 4: '1', 6: '1.5', 8: '2', 10: '2.5', 12: '3',
    14: '3.5', 16: '4', 20: '5', 24: '6', 28: '7', 32: '8', 36: '9', 40: '10',
    44: '11', 48: '12', 56: '14', 64: '16', 80: '20', 96: '24', 112: '28',
    128: '32', 144: '36', 160: '40', 176: '44', 192: '48', 208: '52',
    224: '56', 240: '60', 256: '64', 288: '72', 320: '80', 384: '96',
};

function pxToSpacing(px: number): string {
    if (spacingScale[px]) return spacingScale[px];
    // Find closest match
    const keys = Object.keys(spacingScale).map(Number);
    const closest = keys.reduce((prev, curr) => Math.abs(curr - px) < Math.abs(prev - px) ? curr : prev);
    return spacingScale[closest] || `[${px}px]`;
}

function parsePixelValue(value: string): number | null {
    const match = value.match(/^(-?\d+(?:\.\d+)?)(px)?$/);
    return match ? parseFloat(match[1]) : null;
}

function convertColor(color: string): string | null {
    const lower = color.toLowerCase().trim();
    if (colorMap[lower]) return colorMap[lower];
    // Return arbitrary value for hex colors
    if (lower.startsWith('#')) return `[${lower}]`;
    if (lower.startsWith('rgb')) return `[${lower}]`;
    return null;
}

// Property converters
const converters: Record<CSSProperty, (value: CSSValue) => TailwindClass | null> = {
    'display': (v) => {
        const map: Record<string, string> = { 'block': 'block', 'inline-block': 'inline-block', 'inline': 'inline', 'flex': 'flex', 'grid': 'grid', 'none': 'hidden', 'inline-flex': 'inline-flex' };
        return map[v] || null;
    },
    'position': (v) => {
        const map: Record<string, string> = { 'static': 'static', 'relative': 'relative', 'absolute': 'absolute', 'fixed': 'fixed', 'sticky': 'sticky' };
        return map[v] || null;
    },
    'flex-direction': (v) => {
        const map: Record<string, string> = { 'row': 'flex-row', 'row-reverse': 'flex-row-reverse', 'column': 'flex-col', 'column-reverse': 'flex-col-reverse' };
        return map[v] || null;
    },
    'flex-wrap': (v) => {
        const map: Record<string, string> = { 'wrap': 'flex-wrap', 'nowrap': 'flex-nowrap', 'wrap-reverse': 'flex-wrap-reverse' };
        return map[v] || null;
    },
    'justify-content': (v) => {
        const map: Record<string, string> = { 'flex-start': 'justify-start', 'flex-end': 'justify-end', 'center': 'justify-center', 'space-between': 'justify-between', 'space-around': 'justify-around', 'space-evenly': 'justify-evenly' };
        return map[v] || null;
    },
    'align-items': (v) => {
        const map: Record<string, string> = { 'flex-start': 'items-start', 'flex-end': 'items-end', 'center': 'items-center', 'baseline': 'items-baseline', 'stretch': 'items-stretch' };
        return map[v] || null;
    },
    'text-align': (v) => {
        const map: Record<string, string> = { 'left': 'text-left', 'center': 'text-center', 'right': 'text-right', 'justify': 'text-justify' };
        return map[v] || null;
    },
    'font-weight': (v) => {
        const map: Record<string, string> = { '100': 'font-thin', '200': 'font-extralight', '300': 'font-light', '400': 'font-normal', '500': 'font-medium', '600': 'font-semibold', '700': 'font-bold', '800': 'font-extrabold', '900': 'font-black', 'normal': 'font-normal', 'bold': 'font-bold' };
        return map[v] || null;
    },
    'font-size': (v) => {
        const sizes: Record<string, string> = { '12px': 'text-xs', '14px': 'text-sm', '16px': 'text-base', '18px': 'text-lg', '20px': 'text-xl', '24px': 'text-2xl', '30px': 'text-3xl', '36px': 'text-4xl', '48px': 'text-5xl', '60px': 'text-6xl', '72px': 'text-7xl', '96px': 'text-8xl', '128px': 'text-9xl' };
        return sizes[v] || (v.endsWith('px') ? `text-[${v}]` : null);
    },
    'color': (v) => { const c = convertColor(v); return c ? `text-${c}` : null; },
    'background-color': (v) => { const c = convertColor(v); return c ? `bg-${c}` : null; },
    'border-color': (v) => { const c = convertColor(v); return c ? `border-${c}` : null; },
    'width': (v) => {
        if (v === '100%') return 'w-full';
        if (v === 'auto') return 'w-auto';
        if (v === 'fit-content') return 'w-fit';
        if (v === 'max-content') return 'w-max';
        if (v === 'min-content') return 'w-min';
        if (v === '100vw') return 'w-screen';
        const px = parsePixelValue(v);
        return px !== null ? `w-${pxToSpacing(px)}` : null;
    },
    'height': (v) => {
        if (v === '100%') return 'h-full';
        if (v === 'auto') return 'h-auto';
        if (v === 'fit-content') return 'h-fit';
        if (v === '100vh') return 'h-screen';
        const px = parsePixelValue(v);
        return px !== null ? `h-${pxToSpacing(px)}` : null;
    },
    'padding': (v) => {
        const px = parsePixelValue(v);
        return px !== null ? `p-${pxToSpacing(px)}` : null;
    },
    'padding-top': (v) => { const px = parsePixelValue(v); return px !== null ? `pt-${pxToSpacing(px)}` : null; },
    'padding-right': (v) => { const px = parsePixelValue(v); return px !== null ? `pr-${pxToSpacing(px)}` : null; },
    'padding-bottom': (v) => { const px = parsePixelValue(v); return px !== null ? `pb-${pxToSpacing(px)}` : null; },
    'padding-left': (v) => { const px = parsePixelValue(v); return px !== null ? `pl-${pxToSpacing(px)}` : null; },
    'margin': (v) => {
        if (v === 'auto') return 'm-auto';
        const px = parsePixelValue(v);
        return px !== null ? `m-${pxToSpacing(px)}` : null;
    },
    'margin-top': (v) => { if (v === 'auto') return 'mt-auto'; const px = parsePixelValue(v); return px !== null ? `mt-${pxToSpacing(px)}` : null; },
    'margin-right': (v) => { if (v === 'auto') return 'mr-auto'; const px = parsePixelValue(v); return px !== null ? `mr-${pxToSpacing(px)}` : null; },
    'margin-bottom': (v) => { if (v === 'auto') return 'mb-auto'; const px = parsePixelValue(v); return px !== null ? `mb-${pxToSpacing(px)}` : null; },
    'margin-left': (v) => { if (v === 'auto') return 'ml-auto'; const px = parsePixelValue(v); return px !== null ? `ml-${pxToSpacing(px)}` : null; },
    'gap': (v) => { const px = parsePixelValue(v); return px !== null ? `gap-${pxToSpacing(px)}` : null; },
    'border-radius': (v) => {
        const map: Record<string, string> = { '0': 'rounded-none', '0px': 'rounded-none', '2px': 'rounded-sm', '4px': 'rounded', '6px': 'rounded-md', '8px': 'rounded-lg', '12px': 'rounded-xl', '16px': 'rounded-2xl', '24px': 'rounded-3xl', '9999px': 'rounded-full', '50%': 'rounded-full' };
        return map[v] || (v.endsWith('px') ? `rounded-[${v}]` : null);
    },
    'opacity': (v) => {
        const val = parseFloat(v);
        if (isNaN(val)) return null;
        const percent = Math.round(val * 100);
        const map: Record<number, string> = { 0: 'opacity-0', 5: 'opacity-5', 10: 'opacity-10', 20: 'opacity-20', 25: 'opacity-25', 30: 'opacity-30', 40: 'opacity-40', 50: 'opacity-50', 60: 'opacity-60', 70: 'opacity-70', 75: 'opacity-75', 80: 'opacity-80', 90: 'opacity-90', 95: 'opacity-95', 100: 'opacity-100' };
        return map[percent] || `opacity-[${v}]`;
    },
    'overflow': (v) => {
        const map: Record<string, string> = { 'auto': 'overflow-auto', 'hidden': 'overflow-hidden', 'visible': 'overflow-visible', 'scroll': 'overflow-scroll' };
        return map[v] || null;
    },
    'cursor': (v) => {
        const map: Record<string, string> = { 'pointer': 'cursor-pointer', 'default': 'cursor-default', 'move': 'cursor-move', 'not-allowed': 'cursor-not-allowed', 'wait': 'cursor-wait', 'text': 'cursor-text', 'grab': 'cursor-grab', 'grabbing': 'cursor-grabbing' };
        return map[v] || null;
    },
    'z-index': (v) => {
        const map: Record<string, string> = { '0': 'z-0', '10': 'z-10', '20': 'z-20', '30': 'z-30', '40': 'z-40', '50': 'z-50', 'auto': 'z-auto' };
        return map[v] || `z-[${v}]`;
    },
};

/**
 * Convert CSS style object to Tailwind classes
 * @param styles - CSS styles object (key: property, value: CSS value)
 * @returns Conversion result with classes array and unconverted properties
 */
export function cssToTailwind(styles: Record<string, string>): ConversionResult {
    const classes: string[] = [];
    const unconverted: Record<string, string> = {};

    for (const [prop, value] of Object.entries(styles)) {
        if (!value || value === '') continue;
        const converter = converters[prop];
        if (converter) {
            const tw = converter(value);
            if (tw) classes.push(tw);
            else unconverted[prop] = value;
        } else {
            unconverted[prop] = value;
        }
    }

    return { classes, unconverted };
}

/**
 * Convert CSS string to Tailwind classes
 * @param cssString - CSS string (e.g., "display: flex; padding: 16px;")
 * @returns Conversion result
 */
export function cssStringToTailwind(cssString: string): ConversionResult {
    const styles: Record<string, string> = {};
    const declarations = cssString.split(';').filter(Boolean);
    for (const decl of declarations) {
        const [prop, ...valueParts] = decl.split(':');
        if (prop && valueParts.length) {
            styles[prop.trim()] = valueParts.join(':').trim();
        }
    }
    return cssToTailwind(styles);
}

/**
 * Get Tailwind class string from styles
 * @param styles - CSS styles object
 * @returns Space-separated Tailwind classes
 */
export function getTailwindClasses(styles: Record<string, string>): string {
    return cssToTailwind(styles).classes.join(' ');
}

export default { cssToTailwind, cssStringToTailwind, getTailwindClasses };
