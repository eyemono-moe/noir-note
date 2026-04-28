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
vp install   # Install dependencies
vp dev       # Start dev server
vp run check # Type check + lint + format + knip
vp run fix   # Auto-fix lint/format + knip --fix (remove unused exports/deps)
vp build     # Production build
vp preview   # Preview production build
```

> **Note:** `vp build` normally terminates immediately after the build. The
> `vite-bundle-analyzer` plugin is disabled unless `ANALYZE=true` is set; when
> enabled it starts an interactive server and the process stays alive until
> manually stopped.

---

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, but it invokes Vite through `vp dev` and `vp build`.

## Vite+ Workflow

`vp` is a global binary that handles the full development lifecycle. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

### Start

- create - Create a new project from a template
- migrate - Migrate an existing project to Vite+
- config - Configure hooks and agent integration
- staged - Run linters on staged files
- install (`i`) - Install dependencies
- env - Manage Node.js versions

### Develop

- dev - Run the development server
- check - Run format, lint, and TypeScript type checks
- lint - Lint code
- fmt - Format code
- test - Run tests

### Execute

- run - Run monorepo tasks
- exec - Execute a command from local `node_modules/.bin`
- dlx - Execute a package binary without installing it as a dependency
- cache - Manage the task cache

### Build

- build - Build for production
- pack - Build libraries
- preview - Preview production build

### Manage Dependencies

Vite+ automatically detects and wraps the underlying package manager such as pnpm, npm, or Yarn through the `packageManager` field in `package.json` or package manager-specific lockfiles.

- add - Add packages to dependencies
- remove (`rm`, `un`, `uninstall`) - Remove packages from dependencies
- update (`up`) - Update packages to latest versions
- dedupe - Deduplicate dependencies
- outdated - Check for outdated packages
- list (`ls`) - List installed packages
- why (`explain`) - Show why a package is installed
- info (`view`, `show`) - View package information from the registry
- link (`ln`) / unlink - Manage local package links
- pm - Forward a command to the package manager

### Maintain

- upgrade - Update `vp` itself to the latest version

These commands map to their corresponding tools. For example, `vp dev --port 3000` runs Vite's dev server and works the same as Vite. `vp test` runs JavaScript tests through the bundled Vitest. The version of all tools can be checked using `vp --version`. This is useful when researching documentation, features, and bugs.

## Common Pitfalls

- **Using the package manager directly:** Do not use pnpm, npm, or Yarn directly. Vite+ can handle all package manager operations.
- **Always use Vite commands to run tools:** Don't attempt to run `vp vitest` or `vp oxlint`. They do not exist. Use `vp test` and `vp lint` instead.
- **Running scripts:** Vite+ built-in commands (`vp dev`, `vp build`, `vp test`, etc.) always run the Vite+ built-in tool, not any `package.json` script of the same name. To run a custom script that shares a name with a built-in command, use `vp run <script>`. For example, if you have a custom `dev` script that runs multiple services concurrently, run it with `vp run dev`, not `vp dev` (which always starts Vite's dev server).
- **Do not install Vitest, Oxlint, Oxfmt, or tsdown directly:** Vite+ wraps these tools. They must not be installed directly. You cannot upgrade these tools by installing their latest versions. Always use Vite+ commands.
- **Use Vite+ wrappers for one-off binaries:** Use `vp dlx` instead of package-manager-specific `dlx`/`npx` commands.
- **Import JavaScript modules from `vite-plus`:** Instead of importing from `vite` or `vitest`, all modules should be imported from the project's `vite-plus` dependency. For example, `import { defineConfig } from 'vite-plus';` or `import { expect, test, vi } from 'vite-plus/test';`. You must not install `vitest` to import test utilities.
- **Type-Aware Linting:** There is no need to install `oxlint-tsgolint`, `vp lint --type-aware` works out of the box.

## CI Integration

For GitHub Actions, consider using [`voidzero-dev/setup-vp`](https://github.com/voidzero-dev/setup-vp) to replace separate `actions/setup-node`, package-manager setup, cache, and install steps with a single action.

```yaml
- uses: voidzero-dev/setup-vp@v1
  with:
    cache: true
- run: vp check
- run: vp test
```

## Review Checklist for Agents

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to validate changes.
<!--VITE PLUS END-->
