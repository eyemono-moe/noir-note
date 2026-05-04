# eyemono.md

A browser-based markdown note-taking app. All notes and attachments stored locally using OPFS (Origin Private File System). No backend.

## Technology Stack

- **Frontend**: SolidJS 1.9.12, @solidjs/router
- **Storage**: OPFS via Web Worker (`FileSystemSyncAccessHandle`) + TanStack DB for reactivity
- **Editor**: CodeMirror 6.x with markdown extensions and formatting worker
- **UI Components**: Ark UI 5.36.0, @solid-primitives/\*
- **Markdown**: unified + remark plugins
- **Styling**: UnoCSS with presetIcons (Material Symbols)

## Architecture

### Storage Pattern

All persistent data lives in OPFS, accessed through dedicated Web Workers using the synchronous `FileSystemSyncAccessHandle` API (worker-only, lower latency than async writes on the main thread).

**Notes** (`src/db/noteStore.worker.ts` + `src/db/noteStore.ts`):

- Each note is stored as `OPFS/notes/{base64url(path)}.json` containing the full `MemoDocument`
- Worker handles list / write / delete / getSize operations
- Main thread communicates with the worker via a Promise-based message bridge (`noteStore`)

**Attachments** (`src/db/imageStore.ts`):

- Binary files stored as `OPFS/attachments/{uuid}-{filename}`
- Accessed directly from the main thread using the async OPFS API (no worker needed for binary blobs)

**TanStack DB** wraps both OPFS stores with reactive query primitives via `useLiveQuery`. Updates go through `collection.insert()` / `collection.update()` / `collection.delete()`, which apply optimistically and then persist to OPFS.

**Cross-tab sync** uses `BroadcastChannel`. The shared helper `createOpfsBroadcastSync()` (`src/db/opfsSync.ts`) implements the subscribe-before-fetch + event-buffer pattern to avoid losing events during the initial enumerate.

Key files:

```text
src/db/
  opfsSync.ts              ← shared BroadcastChannel sync helper
  noteStore.ts             ← main-thread bridge (Promise API over postMessage)
  noteStore.worker.ts      ← OPFS Worker (FileSystemSyncAccessHandle writes)
  memoCollection.ts        ← TanStack DB notes collection + imperative queries
  imageStore.ts            ← async OPFS helpers for attachment binary files
  attachmentCollection.ts  ← TanStack DB attachments collection
  migration.ts             ← one-time IndexedDB → OPFS migration (runs on startup)
src/context/db.tsx         ← DBProvider + useMemosCollection() hook
```

### BroadcastChannel message types

When writing mutations, broadcast the correct TanStack DB message type:

- `onInsert` → `{ type: "insert", value: modified }`
- `onUpdate` → `{ type: "update", value: modified }` ← **not** "insert"; using "insert" for an existing key crashes TanStack DB with a `Symbol(liveQueryInternal)` error
- `onDelete` → `{ type: "delete", key }`

### Command System

All user actions are modeled as `Command` objects registered in `src/commands/registry.ts`. The command palette (`Cmd/Ctrl+K`) searches over these. Keyboard shortcuts are also declared on command objects.

### View Modes

Edit/split/preview mode is controlled by adjusting Ark UI Splitter panel sizes via the API stored in `src/context/editorSplit.tsx`. The sidebar occupies the first panel; editor and preview share the remaining two.

### Markdown Processing

- **Editor**: CodeMirror 6 extensions in `src/editor/`
- **Preview**: unified pipeline in `src/components/Preview/`
- **Formatting**: Web Worker at `src/workers/formatter.worker.ts` (fast-diff) to avoid blocking the main thread

### Frontmatter

Notes support YAML frontmatter for metadata (title, tags, etc.). Parsed via `src/utils/frontmatter.ts`; the parsed `metadata` object is stored alongside `content` in the OPFS JSON file.

## Styling

### Overview

UnoCSS (`presetWind3` + `presetIcons`) is the primary styling tool. CSS Modules
are reserved for specific CSS-only features. All other component styling uses
UnoCSS utility classes applied directly to the `class` prop.

### When to use CSS Modules

Use CSS Modules **only** for:

- `@keyframes` animation definitions
- Dynamic styles that require CSS variables injected from JS and computed via
  `calc()` (e.g. tree indentation: `calc(var(--depth) * ...)`)
- Component-level overrides of Ark UI CSS custom properties
  (e.g. `--splitter-border-color`)

**Use UnoCSS for everything else** — layout, spacing, color, typography, and
Ark UI data-attribute state styles.

### Ark UI state-based styling

Style Ark UI component states with UnoCSS data-attribute variants instead of
CSS Modules selectors:

```tsx
// Preferred
<Combobox.Item
  class="rounded px-3 py-2 cursor-pointer
  hover:bg-surface-transparent-hover data-[highlighted]:bg-surface-transparent-hover
  data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
/>

// Avoid (use CSS Modules only when @keyframes or calc() is needed)
// .Item { &[data-highlighted] { background: var(...) } }
```

### Class composition

Prefer template literals for conditional classes. Use SolidJS `classList` only
when multiple independent boolean conditions make it genuinely clearer:

```tsx
// Preferred — single conditional expression
<button class={`button ${isDanger ? "text-text-danger" : "text-text-accent"}`} />

// Use classList for multiple independent conditions
<div classList={{ hidden: !isVisible(), "pointer-events-none": isDisabled() }} />
```

Never mix CSS Module class references and UnoCSS utility classes in the same
template literal:

```tsx
// Avoid
<span class={`${styles.Icon} size-5 text-text-secondary`} />

// Preferred — express all styles as utility classes directly
<span class="size-5 shrink-0 text-text-secondary i-material-symbols:search" />
```

### Color tokens

Always reference colors through UnoCSS theme tokens (`text-text-primary`,
`bg-surface-primary`, `border-border-primary`, etc.) in TSX files. Raw CSS
variables (`var(--color-*)`) are an implementation detail and must only appear
inside `.module.css` files.

### Icons

Material Symbols icons are available as UnoCSS utility classes via `presetIcons`.
Pair them with `size-*` and `shrink-0`:

```tsx
<span class="i-material-symbols:search size-5 shrink-0" />
```

### UnoCSS shortcuts

| Shortcut     | Description                                                                   |
| ------------ | ----------------------------------------------------------------------------- |
| `button`     | Standard interactive button — border, surface background, hover/active states |
| `focus-ring` | `focus-visible` outline using accent color with -2px offset                   |

## Design Decisions

1. **OPFS + Web Worker** — `FileSystemSyncAccessHandle` (worker-only) gives synchronous, lower-latency writes. Main thread accesses storage via a Promise-based message bridge (`noteStore.ts`)
2. **TanStack DB** — provides reactive query primitives (`useLiveQuery`) on top of the OPFS store; optimistic updates apply immediately to the UI
3. **BroadcastChannel for cross-tab sync** — each mutation handler broadcasts the change; the sync function buffers events received during the initial OPFS enumerate
4. **unified over marked** — More composable remark plugin ecosystem
5. **Web Worker for formatting** — Non-blocking markdown formatting; fast-diff minimizes diff computation cost
6. **Ark UI** — Accessible headless components with minimal styling assumptions
7. **LocalStorage for UI state** — Simple persistence for theme and other UI preferences; kept separate from note data

## Development Commands

```bash
vp install      # Install dependencies
vp dev          # Start dev server
vp run check    # Type check + lint + format + knip
vp run fix      # Auto-fix lint/format + knip --fix (remove unused exports/deps)
vp test         # Run unit tests with Vitest
vp run test:e2e # Run Playwright end-to-end tests
vp build        # Production build
vp preview      # Preview production build
```

> **Note:** `vp build` normally terminates immediately after the build. The
> `vite-bundle-analyzer` plugin is disabled unless `ANALYZE=true` is set; when
> enabled it starts an interactive server and the process stays alive until
> manually stopped.

---

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.

<!--VITE PLUS END-->
