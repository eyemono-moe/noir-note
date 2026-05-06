# eyemono.md Agent Instructions

Follow these project instructions when working in this repository.

## Project overview

A browser-based markdown note-taking app. All notes and attachments are stored
locally using OPFS (Origin Private File System). There is no backend.

## Technology stack

- Frontend: SolidJS 1.9.12, `@solidjs/router`
- Storage: OPFS via Web Worker (`FileSystemSyncAccessHandle`) + TanStack DB for reactivity
- Editor: CodeMirror 6.x with markdown extensions and formatting worker
- UI Components: Ark UI 5.36.0, `@solid-primitives/*`
- Markdown: unified + remark plugins
- Styling: UnoCSS with presetIcons (Material Symbols)
- Toolchain: Vite+ (`vp`) on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task

## Codex operating rules

- Prefer small, focused changes. Do not rewrite unrelated files.
- Inspect the relevant code before editing; do not infer architecture from filenames alone.
- Preserve local-first behavior. Do not add backend services or remote persistence unless explicitly requested.
- Do not store note data in `localStorage`; note and attachment persistence belongs in OPFS/TanStack DB.
- Keep user data private and offline-first.
- When changing dependencies, update the package manager lockfile and mention why the dependency is needed.
- Do not commit changes unless the user explicitly asks.
- Before finishing code changes, run the smallest validation that covers the change. Prefer `vp run check` and `vp test` for broad validation when feasible.

## Architecture

### Storage pattern

All persistent data lives in OPFS. Notes are accessed through a dedicated Web
Worker using synchronous `FileSystemSyncAccessHandle` APIs because those are
worker-only and lower-latency than async writes on the main thread.

Notes:

- `src/db/noteStore.worker.ts`: OPFS worker for list/write/delete/getSize operations
- `src/db/noteStore.ts`: main-thread Promise bridge over `postMessage`
- Each note is stored as `OPFS/notes/{base64url(path)}.json` containing the full `MemoDocument`

Attachments:

- `src/db/imageStore.ts`: async OPFS helpers for binary attachments
- Binary files are stored as `OPFS/attachments/{uuid}-{filename}`
- Attachments are accessed directly from the main thread; no worker is needed for binary blobs

TanStack DB:

- `src/db/memoCollection.ts`: notes collection + imperative queries
- `src/db/attachmentCollection.ts`: attachments collection
- `src/context/db.tsx`: `DBProvider` and `useMemosCollection()` hook
- Updates go through `collection.insert()`, `collection.update()`, and `collection.delete()` so optimistic UI and OPFS persistence stay aligned

Cross-tab sync:

- `src/db/opfsSync.ts` contains `createOpfsBroadcastSync()`
- It uses a subscribe-before-fetch + event-buffer pattern to avoid losing BroadcastChannel events during initial enumeration

### BroadcastChannel message types

When writing mutation handlers, broadcast the correct TanStack DB message type:

- `onInsert` -> `{ type: "insert", value: modified }`
- `onUpdate` -> `{ type: "update", value: modified }`
- `onDelete` -> `{ type: "delete", key }`

Never broadcast `"insert"` for an existing key. TanStack DB can crash with a
`Symbol(liveQueryInternal)` error when an update is incorrectly announced as an
insert.

### Command system

All user actions are modeled as `Command` objects registered in
`src/commands/registry.ts`. The command palette (`Cmd/Ctrl+K`) searches over
these commands. Keyboard shortcuts are declared on command objects.

When adding a user-facing action, prefer adding or updating a command rather
than wiring an isolated one-off handler.

### View modes

Edit/split/preview mode is controlled by adjusting Ark UI Splitter panel sizes
through the API stored in `src/context/editorSplit.tsx`. The sidebar occupies the
first panel; editor and preview share the remaining two.

### Markdown processing

- Editor: CodeMirror 6 extensions in `src/editor/`
- Preview: unified pipeline in `src/components/Preview/`
- Formatting: Web Worker at `src/workers/formatter.worker.ts` using `fast-diff` to avoid blocking the main thread

### Frontmatter

Notes support YAML frontmatter for metadata such as `title` and `tags`. Parsed
metadata is handled in `src/utils/frontmatter.ts` and stored alongside `content`
in OPFS note JSON.

## Styling rules

UnoCSS (`presetWind3` + `presetIcons`) is the primary styling tool. CSS Modules
are reserved only for CSS-only features.

Use CSS Modules only for:

- `@keyframes` animation definitions
- Dynamic styles requiring CSS variables injected from JS and computed via `calc()`
  - Example: tree indentation with `calc(var(--depth) * ...)`
- Component-level overrides of Ark UI CSS custom properties
  - Example: `--splitter-border-color`

Use UnoCSS for layout, spacing, color, typography, and Ark UI data-attribute
state styles.

### Ark UI state styling

Style Ark UI states with UnoCSS data-attribute variants instead of CSS Module
selectors.

Preferred:

```tsx
<Combobox.Item
  class="rounded px-3 py-2 cursor-pointer
  hover:bg-surface-transparent-hover data-[highlighted]:bg-surface-transparent-hover
  data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
/>
```

Avoid:

```css
.Item {
  &[data-highlighted] {
    background: var(...);
  }
}
```

### Class composition

Prefer template literals for a single conditional expression:

```tsx
<button class={`button ${isDanger ? "text-text-danger" : "text-text-accent"}`} />
```

Use SolidJS `classList` only when multiple independent boolean conditions make it
clearer:

```tsx
<div classList={{ hidden: !isVisible(), "pointer-events-none": isDisabled() }} />
```

Never mix CSS Module class references and UnoCSS utility classes in the same
template literal.

Avoid:

```tsx
<span class={`${styles.Icon} size-5 text-text-secondary`} />
```

Preferred:

```tsx
<span class="size-5 shrink-0 text-text-secondary i-material-symbols:search" />
```

### Color tokens

Always reference colors through UnoCSS theme tokens in TSX files, for example:

- `text-text-primary`
- `bg-surface-primary`
- `border-border-primary`

Raw CSS variables such as `var(--color-*)` are implementation details and should
only appear inside `.module.css` files.

### Icons

Material Symbols icons are available as UnoCSS utility classes via
`presetIcons`. Pair them with `size-*` and `shrink-0`:

```tsx
<span class="i-material-symbols:search size-5 shrink-0" />
```

### UnoCSS shortcuts

- `button`: standard interactive button with border, surface background, hover/active states
- `focus-ring`: `focus-visible` outline using accent color with `-2px` offset

## Design decisions to preserve

1. OPFS + Web Worker: `FileSystemSyncAccessHandle` is worker-only and gives lower-latency writes.
2. TanStack DB: provides reactive query primitives over OPFS with optimistic updates.
3. BroadcastChannel for cross-tab sync: mutation handlers broadcast changes, and initial sync buffers events.
4. unified over marked: keep the composable remark plugin ecosystem.
5. Web Worker for formatting: avoid blocking the main thread; `fast-diff` minimizes editor updates.
6. Ark UI: accessible headless components with minimal styling assumptions.
7. LocalStorage for UI state only: theme and UI preferences may use localStorage; note data must not.

## Development commands

```bash
vp install       # Install dependencies
vp dev           # Start dev server
vp run check     # Type check + lint + format + knip
vp run fix       # Auto-fix lint/format + knip --fix
vp test          # Run unit tests with Vitest
vp run test:e2e  # Run Playwright end-to-end tests
vp build         # Production build
vp preview       # Preview production build
```

Notes:

- Run `vp install` after pulling remote changes and before starting work if dependencies may have changed.
- Check `vite.config.ts` tasks and `package.json` scripts for validation commands related to the change.
- `vp build` normally terminates immediately. If `ANALYZE=true` is set, `vite-bundle-analyzer` starts an interactive server and the process stays alive until stopped.

## Validation guidance

- For most source changes, run `vp run check`.
- For logic changes with unit coverage, also run `vp test`.
- For browser flows, run `vp run test:e2e` when the change affects routing, preview behavior, command palette, PWA behavior, or image interactions.
- If full validation is too expensive, run the narrowest applicable check and explain what was not run.

## Relationship to CLAUDE.md

`CLAUDE.md` contains the original Claude-oriented project context. Keep this
`AGENTS.md` in sync with durable project rules from `CLAUDE.md`, but prefer
agent-neutral operational guidance here rather than asking tools to read another
agent's instruction file.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.

<!--VITE PLUS END-->
