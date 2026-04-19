# eyemono.md

A browser-based markdown note-taking app that runs entirely in the browser. All notes are stored locally using IndexedDB.

## Technology Stack

- **Frontend**: SolidJS 1.9.12, @solidjs/router
- **Database**: RxDB 17.1.0 with Dexie storage, TanStack DB for reactivity
- **Editor**: CodeMirror 6.x with markdown extensions and formatting worker
- **UI Components**: Ark UI 5.36.0, @solid-primitives/\*
- **Markdown**: unified with remark plugins
- **Styling**: UnoCSS with presetIcons (Material Symbols)

## Directory Structure

```
src/
├── commands/               # Command system
│   ├── registry.ts        # Command registration & execution
│   ├── palette.tsx        # Command palette UI (Ark UI Combobox + Dialog)
│   ├── definitions/       # Command implementations
│   └── types.ts           # Command interfaces
│
├── components/            # UI components
│   ├── Editor/           # CodeMirror wrapper
│   ├── Preview/          # Markdown preview (unified)
│   ├── Layout/           # Split view (Ark UI Splitter)
│   ├── Sidebar/          # Tree sidebar (Ark UI TreeView)
│   └── Settings/         # Settings dialog
│
├── context/              # SolidJS contexts
│   ├── db.tsx           # RxDB & TanStack DB providers
│   ├── editorSplit.tsx  # Splitter API provider
│   └── uiConfig.tsx     # UI config (theme, LocalStorage)
│
├── db/                   # Database layer
│   ├── rxdb.ts          # RxDB setup & schema
│   └── tanstack.ts      # TanStack DB collection wrapper
│
├── editor/               # CodeMirror extensions
│   ├── extensions.ts    # Bundle all extensions
│   ├── markdown.ts      # Markdown configuration
│   ├── listCompletion.ts # Auto-complete for markdown lists
│   ├── theme.ts         # Monochrome theme
│   └── keymap.ts        # Editor keybindings
│
├── routes/              # Route components
│   └── MemoPage.tsx     # Main memo page (all paths)
│
├── utils/               # Utilities
│   ├── path.ts         # Path manipulation
│   ├── tree.ts         # Build tree from flat list
│   ├── frontmatter.ts  # Parse frontmatter metadata
│   └── constants.ts    # App constants
│
└── workers/             # Web Workers
    └── formatter.worker.ts  # Markdown formatting worker (fast-diff)
```

## Key Architectural Patterns

### Database Layer

```typescript
// RxDB for persistence with IndexedDB
const db = await createRxDatabase({
  name: "noir_notes",
  storage: getRxStorageDexie(),
  multiInstance: true, // Automatic tab synchronization
  eventReduce: true,
});

// TanStack DB collection for reactive queries
const memosCollection = createCollection(rxdbCollectionOptions({ rxCollection: db.memos }));

// Live queries automatically update when data changes
const memos = useLiveQuery((q) => q.from({ memos: collection }).select(({ memos }) => memos));
```

### Optimistic Updates

```typescript
// Updates are immediate in UI, persisted in background
collection.update(path, (draft) => {
  draft.content = newContent;
  draft.updatedAt = Date.now();
  draft.metadata = parsedMetadata;
});
```

### Command System

```typescript
// Command registry with searchable commands
const command: Command = {
  id: "view-mode-edit",
  label: "View: Edit Mode",
  description: "Switch to edit mode",
  shortcut: ["Mod", "1"],
  category: "view",
  execute: (context) => {
    context.setMode("edit");
  },
};

commandRegistry.register(command);
commandRegistry.execute("view-mode-edit", context);
```

### View Mode Control via Splitter API

```typescript
// Splitter API exposed via callback
const commandContext: CommandContext = {
  currentPath: currentPath(),
  navigate: (path) => navigate(path),
  setMode: (mode) => {
    const api = editorSplitter();
    if (!api) return;
    const sidebarSize = api.getSizes()[0];
    switch (mode) {
      case "edit":
        api.setSizes([sidebarSize, 100 - sidebarSize, 0]);
        break;
      case "preview":
        api.setSizes([sidebarSize, 0, 100 - sidebarSize]);
        break;
      case "split":
        api.setSizes([sidebarSize, 50 - sidebarSize / 2, 50 - sidebarSize / 2]);
        break;
    }
  },
};
```

### UI State Management

```typescript
// LocalStorage for UI preferences
const [config, setConfig] = createStorageSignal<UIConfig>("app-config", {
  theme: "system",
});

// Theme applied before first render to prevent flash
document.documentElement.setAttribute("data-theme", resolvedTheme);
```

### Frontmatter Metadata

```typescript
// Parse YAML frontmatter from markdown content
const { metadata, content } = parseFrontmatter(markdownContent);
// metadata: { title?: string, tags?: string[], ... }

// Store in RxDB document
await collection.insert({
  path: "/my-note",
  content: markdownContent, // includes frontmatter
  metadata: metadata,
  createdAt: now,
  updatedAt: now,
});
```

### Markdown Formatting Worker

```typescript
// Format markdown in a Web Worker to avoid blocking main thread
const formattedContent = await formatMarkdown(content);
```

## Features

### Core

- **Path-based navigation**: Each note has a URL path (e.g., `/projects/web-app`)
- **Markdown editor**: CodeMirror 6 with list auto-completion and formatting
- **View modes**: Edit, preview, or split view
- **Command palette**: Cmd/Ctrl+K to search commands and pages
- **Tree sidebar**: Hierarchical note navigation with Ark UI TreeView
- **Auto-save**: Debounced saves to IndexedDB
- **Multi-tab sync**: Changes sync across browser tabs via RxDB

### Keyboard Shortcuts

- `Cmd/Ctrl + K` - Open command palette
- `Cmd/Ctrl + S` or `Cmd/Ctrl + Shift + F` - Format current note
- `Cmd/Ctrl + 1/2/3` - Switch view mode (edit/split/preview)
- `Cmd/Ctrl + Shift + H` - Go to home page

### Styling

- GitHub-inspired command palette design
- Material Symbols icons via UnoCSS presetIcons
- Monochrome CodeMirror theme
- Dark/light/system theme support

## Development Commands

```bash
# Install dependencies
vp install

# Run development server
vp dev

# Type check, lint, and format
vp check

# Build for production
vp build

# Preview production build
vp preview
```

## Design Decisions

1. **RxDB + TanStack DB** - Local-first reactive database with built-in multi-tab sync
2. **unified over marked** - More powerful markdown processing with remark plugins
3. **LocalStorage for UI state** - Simple persistence for theme and settings
4. **Command objects** - Centralized, searchable, testable actions
5. **Ark UI components** - Accessible, well-tested UI primitives
6. **Web Worker for formatting** - Non-blocking markdown formatting using fast-diff
7. **Frontmatter support** - YAML metadata for titles, tags, and custom properties

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
