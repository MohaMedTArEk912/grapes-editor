import JSZip from 'jszip';
import { ProjectSchema } from '../schema';
import { buildReactPage } from './react-builder';
import { generateLogicContext } from './logic-generator';

/**
 * Generator Orchestrator
 * Packages the entire project into a React App ZIP
 */
export const generateProjectKey = async (schema: ProjectSchema): Promise<Blob> => {
    const zip = new JSZip();
    const { name, logicFlows, variables, pages } = schema;

    // 1. Root Files
    zip.file('package.json', JSON.stringify({
        name: name.toLowerCase().replace(/\s+/g, '-'),
        private: true,
        version: '0.0.0',
        type: 'module',
        scripts: {
            "dev": "vite",
            "build": "tsc && vite build",
            "preview": "vite preview"
        },
        dependencies: {
            "react": "^18.2.0",
            "react-dom": "^18.2.0",
            "lucide-react": "^0.309.0",
            "clsx": "^2.1.0",
            "tailwind-merge": "^2.2.0"
        },
        devDependencies: {
            "@types/react": "^18.2.43",
            "@types/react-dom": "^18.2.17",
            "@vitejs/plugin-react": "^4.2.1",
            "autoprefixer": "^10.4.16",
            "postcss": "^8.4.32",
            "tailwindcss": "^3.4.0",
            "typescript": "^5.2.2",
            "vite": "^5.0.8"
        }
    }, null, 2));

    zip.file('vite.config.ts', `
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
})`);

    zip.file('tailwind.config.js', `
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`);

    zip.file('postcss.config.js', `
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`);

    zip.file('tsconfig.json', JSON.stringify({
        "compilerOptions": {
            "target": "ES2020",
            "useDefineForClassFields": true,
            "lib": ["ES2020", "DOM", "DOM.Iterable"],
            "module": "ESNext",
            "skipLibCheck": true,
            "moduleResolution": "bundler",
            "allowImportingTsExtensions": true,
            "resolveJsonModule": true,
            "isolatedModules": true,
            "noEmit": true,
            "jsx": "react-jsx",
            "strict": true,
            "noUnusedLocals": true,
            "noUnusedParameters": true,
            "noFallthroughCasesInSwitch": true
        },
        "include": ["src"],
        "references": [{ "path": "./tsconfig.node.json" }]
    }, null, 2));

    zip.file('tsconfig.node.json', JSON.stringify({
        "compilerOptions": {
            "composite": true,
            "skipLibCheck": true,
            "module": "ESNext",
            "moduleResolution": "bundler",
            "allowSyntheticDefaultImports": true
        },
        "include": ["vite.config.ts"]
    }, null, 2));

    zip.file('index.html', `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`);

    // 2. Source Folder
    const src = zip.folder('src');
    if (!src) throw new Error('Failed to create src folder');

    // Index CSS (Tailwind)
    src.file('index.css', `
@tailwind base;
@tailwind components;
@tailwind utilities;
    `);

    // Main Entry
    src.file('main.tsx', `
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`);

    // Context
    const contextFolder = src.folder('context');
    if (contextFolder) {
        contextFolder.file('LogicContext.tsx', generateLogicContext(variables || [], logicFlows || []));
    }

    // Components & Pages
    const pagesFolder = src.folder('pages');

    // Generate Pages
    // For now we assume single page 'Home' from the first page in schema or index
    const homePage = pages[0];
    if (homePage) {
        const homeContent = buildReactPage('Home', homePage.components || [], logicFlows || []);
        if (pagesFolder) pagesFolder.file('Home.tsx', homeContent);
    }

    // App.tsx (Router / Layout)
    src.file('App.tsx', `
import { LogicProvider } from './context/LogicContext';
import { Home } from './pages/Home';

function App() {
  return (
    <LogicProvider>
      <Home />
    </LogicProvider>
  )
}

export default App
`);

    // 3. Generate ZIP
    return await zip.generateAsync({ type: 'blob' });
};
