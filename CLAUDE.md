# eyemono.md

A browser-based markdown note-taking app. All notes stored locally in IndexedDB. No backend.

## Technology Stack

- **Frontend**: SolidJS 1.9.12, @solidjs/router
- **Database**: RxDB 17.1.0 (Dexie storage) + TanStack DB for reactivity
- **Editor**: CodeMirror 6.x with markdown extensions and formatting worker
- **UI Components**: Ark UI 5.36.0, @solid-primitives/\*
- **Markdown**: unified + remark plugins
- **Styling**: UnoCSS with presetIcons (Material Symbols)

## Architecture

### Database Pattern

RxDB handles IndexedDB persistence with automatic multi-tab sync. TanStack DB wraps the RxDB collection for reactive UI queries via `useLiveQuery`. Updates go through `collection.update()` which applies optimistically.

Key files: `src/db/rxdb.ts`, `src/db/tanstack.ts`, `src/context/db.tsx`

### Command System

All user actions are modeled as `Command` objects registered in `src/commands/registry.ts`. The command palette (`Cmd/Ctrl+K`) searches over these. Keyboard shortcuts are also declared on command objects.

### View Modes

Edit/split/preview mode is controlled by adjusting Ark UI Splitter panel sizes via the API stored in `src/context/editorSplit.tsx`. The sidebar occupies the first panel; editor and preview share the remaining two.

### Markdown Processing

- **Editor**: CodeMirror 6 extensions in `src/editor/`
- **Preview**: unified pipeline in `src/components/Preview/`
- **Formatting**: Web Worker at `src/workers/formatter.worker.ts` (fast-diff) to avoid blocking the main thread

### Frontmatter

Notes support YAML frontmatter for metadata (title, tags, etc.). Parsed via `src/utils/frontmatter.ts`; the parsed `metadata` object is stored alongside `content` in RxDB.

## Design Decisions

1. **RxDB + TanStack DB** — RxDB provides IndexedDB persistence and multi-tab sync; TanStack DB adds reactive query primitives on top
2. **unified over marked** — More composable remark plugin ecosystem
3. **Web Worker for formatting** — Non-blocking markdown formatting; fast-diff minimizes diff computation cost
4. **Ark UI** — Accessible headless components with minimal styling assumptions
5. **LocalStorage for UI state** — Simple persistence for theme and other UI preferences; kept separate from note data

## Development Commands

```bash
vp install   # Install dependencies
vp dev       # Start dev server
vp check     # Type check + lint + format
vp build     # Production build
vp preview   # Preview production build
```

---

<!--VITE PLUS START-->

## Vite+ Toolchain

This project uses Vite+, a unified toolchain (`vp` CLI) wrapping Vite, Rolldown, Vitest, Oxlint, Oxfmt, and tsdown. Run `vp help` for a full command list.

### Common Pitfalls

- **Do not use pnpm/npm/yarn directly** — always use `vp` for all package operations
- **Do not run `vp vitest` or `vp oxlint`** — use `vp test` and `vp lint` instead
- **Custom scripts sharing a built-in name** — use `vp run <script>` (not `vp dev`) to run `package.json` scripts that have the same name as a Vite+ built-in
- **Do not install Vitest, Oxlint, Oxfmt, or tsdown** — they are bundled inside Vite+ and must not be installed separately
- **Use `vp dlx`** instead of `npx` or `pnpm dlx`
- **Import from `vite-plus`** — use `import { defineConfig } from 'vite-plus'` and `import { expect, test, vi } from 'vite-plus/test'`; do not import from `vite` or `vitest` directly
- **Type-aware linting** — `vp lint --type-aware` works out of the box; no extra packages needed

### Agent Checklist

- [ ] Run `vp install` after pulling remote changes and before starting work
- [ ] Run `vp check` and `vp test` to validate changes before finishing

<!--VITE PLUS END-->
