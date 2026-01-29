Prompt instructions file:
Below is the **NEW UI/UX REFACTOR MASTER PLAN** focused on layout, panels, blocks, and project management. This is a **build specification + task breakdown**, not documentation.

---

# 🎨 UI/UX REFACTOR — MASTER PLAN

**Target:** Modern, faster, and more intuitive editor UI
**Stack:** React + TypeScript + Tailwind + GrapesJS (headless)

---

# 0) GLOBAL RULES (DO NOT BREAK)

- Tailwind-only UI
- Schema-first architecture
- No hard deletes
- Keep existing APIs stable unless explicitly required
- Preserve GrapesJS headless usage and custom shell

---

# 1) EDITOR SHELL REWORK

## Goals
- Cleaner layout hierarchy
- Persistent navigation
- Faster access to key panels

## Tasks
- Introduce a **left rail** for global navigation (Project, Pages, Blocks, Assets, Logic, Data, SEO, Publish, Analytics, A11y)
- Move **panel content** to a **single right-side drawer** with tabbed sections
- Add a **center workspace header** (page name, breakpoint, device toggle, preview, undo/redo)
- Create a **collapsible bottom status bar** (sync, save state, selection info)

## Deliverables
- New Editor shell layout
- Panel routing state (active panel, active tab)

---

# 2) BLOCKS EXPERIENCE UPGRADE

## Goals
- Faster block discovery
- Cleaner categories
- Better previews

## Tasks
- Add **block categories** with icons and search
- Add **block preview cards** (hover preview + add button)
- Add **favorites** + **recently used** blocks
- Improve **drag affordances** and empty-state hints
- Add **custom block groups** by project

## Deliverables
- Blocks panel UX refresh
- Block data model for favorites/recent

---

# 3) PROJECT MANAGEMENT UX

## Goals
- Clearer project selection
- Better page tree visibility
- Quick actions

## Tasks
- Rework project picker into a **full-screen modal** with search + grid/list
- Add **project metadata cards** (last edited, published, collaborators)
- Add **page tree panel** with drag-reorder + context actions
- Add **quick actions** (duplicate, archive, publish)

## Deliverables
- New ProjectManager UI
- Updated PageManager with tree view

---

# 4) RIGHT PANEL RESTRUCTURE

## Goals
- Reduce clutter
- Logical grouping
- Faster switching

## Tasks
- Merge **Styles + Traits + Layers** into tabs within one panel
- Add **sticky section headers** in styles
- Add **compact mode** toggle
- Add **search/filter** for style props

## Deliverables
- Unified Inspector panel
- Improved property navigation

---

# 5) PANEL ROUTING & STATE MANAGEMENT

## Goals
- Consistent panel state
- Restore UI on reload

## Tasks
- Add **panel state store** (active panel, tabs, sizes, collapse)
- Persist state in localStorage per project
- Centralize panel navigation actions

## Deliverables
- Panel state store + persistence

---

# 6) ACCESSIBILITY & USABILITY

## Goals
- Better keyboard support
- Clear focus states

## Tasks
- Add keyboard shortcuts for panel switching
- Add focus rings for all interactive UI
- Ensure panel toggles are keyboard accessible

## Deliverables
- Accessible navigation flow

---

# 7) PERFORMANCE & RESPONSIVENESS

## Goals
- Faster UI, smoother panels

## Tasks
- Virtualize long lists (blocks, pages, assets)
- Debounce search inputs
- Add skeleton loaders for panels
- Memoize heavy panel components

## Deliverables
- Noticeably faster panel render

---

# 8) ROLLOUT STRATEGY

## Steps
- Ship behind a **UI refresh toggle** in settings
- Collect usage feedback
- Flip default once stable

---

# 9) FINAL COPILOT PROMPT (USE THIS)

Paste into Copilot Chat:

> “Refactor the editor UI using the UI/UX Refactor Master Plan. Keep GrapesJS headless, Tailwind-only, and schema-first. Prioritize layout shell, blocks UX, project manager, and right inspector panel. No breaking API changes.”

---
