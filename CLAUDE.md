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
