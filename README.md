# GrapesJS Ultimate Editor (React + TypeScript)

A modern, powerful web page builder built with **React**, **TypeScript**, **Vite**, and **TailwindCSS**.

![GrapesJS Editor](https://img.shields.io/badge/GrapesJS-React-6366f1?style=for-the-badge)

## Features

- ⚛️ **Modern Stack** - React 18, TypeScript, Vite
- 🎨 **Beautiful UI** - Dark mode with TailwindCSS styling & Lucide Icons
- 🧩 **Modular Architecture** - Custom hooks (`useGrapes`) and component-based structure
- 📱 **Responsive** - Built-in device switcher
- 📦 **Rich Blocks** - 20+ pre-configured blocks
- ⚡ **Fast** - Instant HMR with Vite

## Project Structure

```bash
src/
├── components/
│   ├── Editor/       # Main editor layout
│   └── Toolbar/      # Editor toolbar
├── hooks/
│   └── useGrapes.ts  # GrapesJS initialization logic
├── utils/
│   └── blocks.ts     # Custom block definitions
├── styles/
│   └── index.css     # Global styles & overrides
├── types/            # TypeScript declarations
├── App.tsx           # Root component
└── main.tsx          # Entry point
```

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Tech Stack

- **Framework**: React 18
- **Language**: TypeScript
- **Bundler**: Vite
- **Styling**: TailwindCSS
- **Core**: GrapesJS
- **Icons**: Lucide React

## License

MIT
