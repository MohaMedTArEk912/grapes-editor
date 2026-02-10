//! Frontend Code Generator
//! 
//! Generates a production-ready React + Tailwind frontend from UI blocks,
//! data models, and API definitions. Output includes:
//!   - Page components with data fetching hooks
//!   - Auth pages (login + register)
//!   - API client utility
//!   - Auth context + protected routes
//!   - App.tsx with full routing
//!   - Layout component
//!   - package.json, vite config, tailwind config, tsconfig

use crate::schema::{ProjectSchema, BlockSchema, BlockType, DataModelSchema, ApiSchema, HttpMethod};

pub struct FrontendGenerator<'a> {
    project: &'a ProjectSchema,
}

impl<'a> FrontendGenerator<'a> {
    pub fn new(project: &'a ProjectSchema) -> Self {
        Self { project }
    }

    pub fn generate(&self) -> GeneratedFrontend {
        let mut files = Vec::new();

        // ── Pages from visual canvas ──
        for page in &self.project.pages {
            if !page.archived {
                let code = self.generate_page(page);
                let pascal_name = crate::generator::pascal_case(&page.name);
                files.push(gf(&format!("src/pages/{}.tsx", pascal_name), code));
            }
        }

        // ── Auth pages ──
        files.push(gf("src/pages/Login.tsx", self.gen_login_page()));
        files.push(gf("src/pages/Register.tsx", self.gen_register_page()));

        // ── API client ──
        files.push(gf("src/lib/api.ts", self.gen_api_client()));

        // ── Auth context ──
        files.push(gf("src/context/AuthContext.tsx", Self::gen_auth_context()));

        // ── Hooks: per-model data hooks ──
        let models: Vec<&DataModelSchema> = self.project.data_models.iter().filter(|m| !m.archived).collect();
        for model in &models {
            files.push(gf(
                &format!("src/hooks/use{}.ts", crate::generator::pascal_case(&model.name)),
                self.gen_model_hook(model),
            ));
        }

        // ── Layout ──
        files.push(gf("src/components/Layout.tsx", self.gen_layout()));

        // ── App.tsx with routing ──
        files.push(gf("src/App.tsx", self.gen_app()));

        // ── main.tsx ──
        files.push(gf("src/main.tsx", Self::gen_main_tsx()));

        // ── index.css ──
        files.push(gf("src/index.css", Self::gen_index_css()));

        // ── Config files ──
        files.push(gf("package.json", self.gen_package_json()));
        files.push(gf("tsconfig.json", Self::gen_tsconfig()));
        files.push(gf("tsconfig.node.json", Self::gen_tsconfig_node()));
        files.push(gf("vite.config.ts", Self::gen_vite_config()));
        files.push(gf("tailwind.config.js", Self::gen_tailwind_config()));
        files.push(gf("postcss.config.js", Self::gen_postcss_config()));
        files.push(gf("index.html", self.gen_index_html()));
        files.push(gf(".env", self.gen_dotenv()));

        GeneratedFrontend { files }
    }

    // ── Page from visual blocks ──────────────────────────

    fn generate_page(&self, page: &crate::schema::PageSchema) -> String {
        let pascal = crate::generator::pascal_case(&page.name);
        let mut jsx = String::new();

        if let Some(root_id) = &page.root_block_id {
            if let Some(block) = self.project.find_block(root_id) {
                if !block.archived {
                    jsx.push_str(&self.generate_block_jsx(block, 3));
                }
            }
        }

        format!(r#"import React from 'react';

export default function {name}() {{
  return (
    <div className="min-h-screen bg-white">
{jsx}    </div>
  );
}}
"#, name = pascal, jsx = jsx)
    }

    fn generate_block_jsx(&self, block: &BlockSchema, indent: usize) -> String {
        let pad = "  ".repeat(indent);
        let classes = block.classes.join(" ");

        let (tag, self_closing) = match &block.block_type {
            BlockType::Container | BlockType::Section => ("div", false),
            BlockType::Heading => ("h1", false),
            BlockType::Paragraph | BlockType::Text => ("p", false),
            BlockType::Button => ("button", false),
            BlockType::Image => ("img", true),
            BlockType::Input => ("input", true),
            BlockType::Link => ("a", false),
            BlockType::Form => ("form", false),
            BlockType::TextArea => ("textarea", false),
            BlockType::Select => ("select", false),
            BlockType::Checkbox => ("input", true),
            BlockType::Video => ("video", false),
            _ => ("div", false),
        };

        let mut out = String::new();
        out.push_str(&format!("{pad}{{/* @akasha-block id=\"{}\" */}}\n", block.id));

        if self_closing {
            out.push_str(&format!("{pad}<{tag} className=\"{classes}\" />\n"));
        } else {
            out.push_str(&format!("{pad}<{tag} className=\"{classes}\">"));

            let text = block.properties.get("text").and_then(|v| v.as_str()).unwrap_or("");
            let has_children = !block.children.is_empty();

            if has_children {
                out.push('\n');
                if !text.is_empty() {
                    out.push_str(&format!("{}  {text}\n", pad));
                }
                for child_id in &block.children {
                    if let Some(child) = self.project.find_block(child_id) {
                        if !child.archived {
                            out.push_str(&self.generate_block_jsx(child, indent + 1));
                        }
                    }
                }
                out.push_str(&format!("{pad}</{tag}>\n"));
            } else {
                out.push_str(&format!("{text}</{tag}>\n"));
            }
        }

        out.push_str(&format!("{pad}{{/* @akasha-block-end */}}\n"));
        out
    }

    // ── Auth pages ───────────────────────────────────────

    fn gen_login_page(&self) -> String {
        r#"import React, { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.token, res.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div>
          <h2 className="text-3xl font-bold text-center text-gray-900">Sign in</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-500">Register</Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded">{error}</div>}
          <div className="space-y-4">
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Email address" />
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Password" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
"#.into()
    }

    fn gen_register_page(&self) -> String {
        r#"import React, { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/register', { name, email, password });
      login(res.token, res.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div>
          <h2 className="text-3xl font-bold text-center text-gray-900">Create account</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">Sign in</Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded">{error}</div>}
          <div className="space-y-4">
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Full name (optional)" />
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Email address" />
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Password (min 6 characters)" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
"#.into()
    }

    // ── API client ───────────────────────────────────────

    fn gen_api_client(&self) -> String {
        r#"const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('token');
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `Request failed: ${res.status}`);
    }

    if (res.status === 204) return undefined as T;
    return res.json();
  }

  get<T>(path: string) { return this.request<T>('GET', path); }
  post<T>(path: string, body?: unknown) { return this.request<T>('POST', path, body); }
  put<T>(path: string, body?: unknown) { return this.request<T>('PUT', path, body); }
  patch<T>(path: string, body?: unknown) { return this.request<T>('PATCH', path, body); }
  delete<T>(path: string) { return this.request<T>('DELETE', path); }
}

export const api = new ApiClient();
"#.into()
    }

    // ── Auth context ─────────────────────────────────────

    fn gen_auth_context() -> String {
        r#"import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface User {
  id: string;
  email: string;
  name?: string;
  [key: string]: unknown;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate('/login');
  }, [isAuthenticated, loading, navigate]);

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!isAuthenticated) return null;
  return <>{children}</>;
}
"#.into()
    }

    // ── Per-model data hook ──────────────────────────────

    fn gen_model_hook(&self, model: &DataModelSchema) -> String {
        let pascal = crate::generator::pascal_case(&model.name);
        let lower = model.name.to_lowercase();
        let plural = pluralize(&lower);

        format!(r#"import {{ useState, useEffect, useCallback }} from 'react';
import {{ api }} from '../lib/api';

interface {pascal} {{
  id: string;
{fields}  createdAt: string;
  updatedAt: string;
}}

interface Paginated{pascal} {{
  data: {pascal}[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}}

export function use{pascal}s(page = 1, limit = 20) {{
  const [data, setData] = useState<{pascal}[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch{pascal}s = useCallback(async () => {{
    setLoading(true);
    setError(null);
    try {{
      const res = await api.get<Paginated{pascal}>(`/{plural}?page=${{page}}&limit=${{limit}}`);
      setData(res.data);
      setTotal(res.total);
    }} catch (err: any) {{
      setError(err.message);
    }} finally {{
      setLoading(false);
    }}
  }}, [page, limit]);

  useEffect(() => {{ fetch{pascal}s(); }}, [fetch{pascal}s]);

  const create{pascal} = async (input: Omit<{pascal}, 'id' | 'createdAt' | 'updatedAt'>) => {{
    const created = await api.post<{pascal}>('/{plural}', input);
    await fetch{pascal}s();
    return created;
  }};

  const update{pascal} = async (id: string, input: Partial<{pascal}>) => {{
    const updated = await api.put<{pascal}>(`/{plural}/${{id}}`, input);
    await fetch{pascal}s();
    return updated;
  }};

  const delete{pascal} = async (id: string) => {{
    await api.delete(`/{plural}/${{id}}`);
    await fetch{pascal}s();
  }};

  return {{ data, total, loading, error, create{pascal}, update{pascal}, delete{pascal}, refresh: fetch{pascal}s }};
}}

export function use{pascal}(id: string | null) {{
  const [data, setData] = useState<{pascal} | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {{
    if (!id) return;
    setLoading(true);
    api.get<{pascal}>(`/{plural}/${{id}}`)
      .then(setData)
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false));
  }}, [id]);

  return {{ data, loading, error }};
}}
"#,
            pascal = pascal,
            plural = plural,
            fields = self.gen_model_fields_ts(model),
        )
    }

    fn gen_model_fields_ts(&self, model: &DataModelSchema) -> String {
        let mut out = String::new();
        for f in &model.fields {
            if f.name == "id" { continue; }
            let ts = match f.field_type {
                crate::schema::data_model::FieldType::String
                | crate::schema::data_model::FieldType::Text
                | crate::schema::data_model::FieldType::Email
                | crate::schema::data_model::FieldType::Url
                | crate::schema::data_model::FieldType::Uuid
                | crate::schema::data_model::FieldType::DateTime => "string",
                crate::schema::data_model::FieldType::Int | crate::schema::data_model::FieldType::Float => "number",
                crate::schema::data_model::FieldType::Boolean => "boolean",
                _ => "unknown",
            };
            let opt = if f.required { "" } else { "?" };
            out.push_str(&format!("  {}{}: {};\n", f.name, opt, ts));
        }
        out
    }

    // ── Layout ───────────────────────────────────────────

    fn gen_layout(&self) -> String {
        let mut nav_links = String::new();
        for page in &self.project.pages {
            if !page.archived {
                let path = if page.path.is_empty() { "/" } else { &page.path };
                nav_links.push_str(&format!(
                    "          <NavLink to=\"{path}\" className={{({{ isActive }}) => `px-3 py-2 rounded-md text-sm font-medium ${{isActive ? 'bg-indigo-700 text-white' : 'text-indigo-100 hover:bg-indigo-500'}}`}}>{name}</NavLink>\n",
                    path = path, name = page.name,
                ));
            }
        }

        format!(r#"import React from 'react';
import {{ Outlet, NavLink }} from 'react-router-dom';
import {{ useAuth }} from '../context/AuthContext';

export default function Layout() {{
  const {{ isAuthenticated, user, logout }} = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-indigo-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <span className="text-white font-bold text-lg">{name}</span>
{links}            </div>
            <div className="flex items-center space-x-4">
              {{isAuthenticated ? (
                <div className="flex items-center space-x-3">
                  <span className="text-indigo-100 text-sm">{{user?.email}}</span>
                  <button onClick={{logout}} className="text-indigo-100 hover:text-white text-sm font-medium">Logout</button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <NavLink to="/login" className="text-indigo-100 hover:text-white text-sm font-medium">Login</NavLink>
                  <NavLink to="/register" className="bg-white text-indigo-600 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-indigo-50">Register</NavLink>
                </div>
              )}}
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 px-4">
        <Outlet />
      </main>
    </div>
  );
}}
"#,
            name = self.project.name,
            links = nav_links,
        )
    }

    // ── App.tsx ───────────────────────────────────────────

    fn gen_app(&self) -> String {
        let mut imports = String::new();
        let mut routes = String::new();

        for page in &self.project.pages {
            if !page.archived {
                let p_name = crate::generator::pascal_case(&page.name);
                imports.push_str(&format!("import {p} from './pages/{p}';\n", p = p_name));
                let path = if page.path.is_empty() { "/" } else { &page.path };
                routes.push_str(&format!(
                    "            <Route path=\"{path}\" element={{<{p} />}} />\n",
                    path = path, p = p_name,
                ));
            }
        }

        format!(r#"import React from 'react';
import {{ BrowserRouter, Routes, Route }} from 'react-router-dom';
import {{ AuthProvider }} from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
{imports}
function App() {{
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={{<Login />}} />
          <Route path="/register" element={{<Register />}} />
          <Route element={{<Layout />}}>
{routes}          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}}

export default App;
"#, imports = imports, routes = routes)
    }

    // ── Boilerplate files ────────────────────────────────

    fn gen_main_tsx() -> String {
        r#"import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
"#.into()
    }

    fn gen_index_css() -> String {
        r#"@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}
"#.into()
    }

    fn gen_package_json(&self) -> String {
        let name = self.project.name.to_lowercase().replace(' ', "-");
        format!(r#"{{
  "name": "{name}-frontend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {{
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }},
  "dependencies": {{
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0"
  }},
  "devDependencies": {{
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }}
}}
"#, name = name)
    }

    fn gen_tsconfig() -> String {
        r#"{
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
    "strict": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
"#.into()
    }

    fn gen_tsconfig_node() -> String {
        r#"{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
"#.into()
    }

    fn gen_vite_config() -> String {
        r#"import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
"#.into()
    }

    fn gen_tailwind_config() -> String {
        r#"/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
"#.into()
    }

    fn gen_postcss_config() -> String {
        r#"export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
"#.into()
    }

    fn gen_index_html(&self) -> String {
        format!(r#"<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
"#, self.project.name)
    }

    fn gen_dotenv(&self) -> String {
        "VITE_API_URL=http://localhost:3000/api\n".into()
    }
}

// ── helpers ──────────────────────────────────────────────

fn gf(path: &str, content: String) -> GeneratedFile {
    GeneratedFile { path: path.to_string(), content }
}

fn pluralize(s: &str) -> String {
    if s.ends_with('s') { s.to_string() }
    else if s.ends_with('y') { format!("{}ies", &s[..s.len()-1]) }
    else { format!("{}s", s) }
}

pub struct GeneratedFrontend {
    pub files: Vec<GeneratedFile>,
}

pub struct GeneratedFile {
    pub path: String,
    pub content: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_frontend() {
        let project = ProjectSchema::new("proj-1", "My App");
        let generator = FrontendGenerator::new(&project);
        let output = generator.generate();

        assert!(!output.files.is_empty());
        assert!(output.files.iter().any(|f| f.path == "src/App.tsx"));
        assert!(output.files.iter().any(|f| f.path == "src/pages/Login.tsx"));
        assert!(output.files.iter().any(|f| f.path == "src/pages/Register.tsx"));
        assert!(output.files.iter().any(|f| f.path == "src/lib/api.ts"));
        assert!(output.files.iter().any(|f| f.path == "src/context/AuthContext.tsx"));
        assert!(output.files.iter().any(|f| f.path.contains("useUser.ts")));
    }
}
