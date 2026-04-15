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

---

# Noir Notes - Future Implementation Plans

This section contains planned features and improvements for future development.

## UI State Persistence Across Navigation

**Priority:** Should (Phase 5.5)

### Problem

Current implementation has several issues:

1. UI state (mode, sidebar) stored in URL query parameters
2. State lost when navigating via sidebar or markdown links (no query params appended)
3. Duplicate state management: `searchParams` + `uiStore` (redundant)
4. `setSearchParams()` calls scattered in MemoPage.tsx
5. Inconsistent options: `{ replace: true }` used for mode but not sidebar

### Simplified Solution: LocalStorage Only

**Decision:** Remove SearchParams entirely. Use LocalStorage for all UI state persistence.

**Rationale:**

- ✅ Simpler implementation (no URL param juggling)
- ✅ State persists across navigation automatically
- ✅ No need to append params on every navigation
- ✅ User preferences remembered
- ❌ URLs not shareable with specific modes (acceptable trade-off)

**Benefits:**

- ✅ State persists across page navigation (LocalStorage)
- ✅ Centralized in custom hook (`useUIState`)
- ✅ No manual URL manipulation needed

### Implementation

#### Step 1: Create `src/hooks/useUIState.ts`

```typescript
import { createStorageSignal } from "@solid-primitives/storage";
import type { ViewMode } from "../types/ui";

export const useUIState = () => {
  // LocalStorage: persist all UI state
  const [mode, setMode] = createStorageSignal<ViewMode>("noir:viewMode", "edit");
  const [sidebarVisible, setSidebarVisible] = createStorageSignal<boolean>("noir:sidebar", false);

  const toggleMode = () => {
    setMode((prev) => {
      if (prev === "edit") return "preview";
      if (prev === "preview") return "split";
      return "edit";
    });
  };

  const toggleSidebar = () => {
    setSidebarVisible((prev) => !prev);
  };

  return {
    mode,
    sidebarVisible,
    setMode,
    toggleMode,
    toggleSidebar,
  };
};
```

#### Step 2: Update MemoPage.tsx

```typescript
import { useUIState } from "../hooks/useUIState";

const MemoPage: Component = () => {
  const navigate = useNavigate();
  const { mode, sidebarVisible, setMode, toggleSidebar } = useUIState();

  // Remove: useSearchParams, setSearchParams
  // Remove: uiActions.setMode/setSidebarVisibility calls
  // Remove: mode/showSidebar computed from searchParams

  // Sidebar
  <Sidebar visible={sidebarVisible()} />;

  // Command context
  const commandContext = createMemo<CommandContext>(() => ({
    navigate, // Direct navigation, no state preservation needed
    setMode,
    toggleSidebar,
    // ...
  }));
};
```

#### Step 3: Update MarkdownPreview for external links

```typescript
// src/components/Preview/MarkdownPreview.tsx
createEffect(() => {
  const container = containerRef;
  if (!container) return;

  // Add target="_blank" to external links
  const handleClick = (e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest("a");
    if (!target) return;

    const href = target.getAttribute("href");
    if (!href) return;

    // External link: open in new tab
    if (href.startsWith("http://") || href.startsWith("https://")) {
      target.setAttribute("target", "_blank");
    }
    // Internal links work normally via router
  };

  container.addEventListener("click", handleClick);
  return () => container.removeEventListener("click", handleClick);
});
```

#### Step 4: Remove uiStore.ts

Since UI state is now managed by the hook, `uiStore.ts` can be removed entirely.

### Testing

- [ ] Navigate via sidebar → mode/sidebar state preserved
- [ ] Click markdown link → mode/sidebar state preserved
- [ ] Refresh page → state restored from LocalStorage
- [ ] Close/reopen browser → preference remembered
- [ ] Toggle mode → persists to LocalStorage
- [ ] Toggle sidebar → persists to LocalStorage
- [ ] External links open in new tab

---

## Frontmatter Metadata Support

**Priority:** Should

### Features

- Support YAML frontmatter at the beginning of Markdown documents
- Store metadata: creation date, update date, tags
- Enable metadata-based search functionality
- (Optional) Full-text search across memo content

### Data Structure

```yaml
---
created: 2025-01-15T10:30:00Z
updated: 2025-01-16T14:20:00Z
tags: [project, important, draft]
title: My Document Title
---
```

### Storage Strategy

- **Dual storage approach** for performance:
  1. Keep raw frontmatter in `content` field (for editing)
  2. Store parsed metadata in separate `metadata` field (for search/filtering)
- Update metadata on save:
  - Parse frontmatter from content
  - Extract metadata into dedicated field
  - Index metadata for fast search

### Search Implementation

- Metadata search: filter by tags, date ranges
- Full-text search: search across document content (if feasible)
- Search UI: command palette integration or dedicated search view

### Schema Changes

```typescript
interface Memo {
  path: string;
  content: string; // includes frontmatter
  metadata?: {
    created?: string;
    updated?: string;
    tags?: string[];
    title?: string;
    [key: string]: unknown; // extensible
  };
  createdAt: number;
  updatedAt: number;
}
```

---

## Keyboard Shortcut System Migration

**Priority:** Should (Future)

### Current State

Using `@solid-primitives/keyboard`'s `createShortcut()` for keyboard handling:

- ✅ Works for basic shortcuts
- ⚠️ Limited flexibility
- ⚠️ No scope support
- ⚠️ Manual registration in palette.tsx

### Proposed: Migrate to TanStack Hotkeys

**Benefits:**

- Better scope management (global vs component-level)
- More intuitive API
- Better conflict detection
- Active maintenance and documentation

**Reference:** https://tanstack.com/hotkeys/latest/docs/overview

### Implementation Plan

1. Install TanStack Hotkeys:

   ```bash
   vp add @tanstack/solid-hotkeys
   ```

2. Create hotkey manager (`src/commands/hotkeys.ts`):

   ```typescript
   import { createHotkey } from "@tanstack/solid-hotkeys";

   export const useCommandHotkeys = (context: CommandContext) => {
     // Command palette
     createHotkey("ctrl+k, meta+k", () => openPalette(), {
       preventDefault: true,
       description: "Open command palette",
     });

     // View mode toggle
     createHotkey("ctrl+\\, meta+\\", () => context.setMode(), {
       preventDefault: true,
       description: "Toggle view mode",
     });

     // Sidebar toggle
     createHotkey("ctrl+shift+b, meta+shift+b", () => context.toggleSidebar(), {
       preventDefault: true,
       description: "Toggle sidebar",
     });
   };
   ```

3. Auto-register from command metadata:
   ```typescript
   // Convert command.shortcut to TanStack format
   const shortcutToHotkey = (shortcut: string[]) => {
     return shortcut.map((k) => (k === "Mod" ? "ctrl, meta" : k.toLowerCase())).join("+");
   };
   ```

### Migration Strategy

- Phase 1: Install and test TanStack Hotkeys alongside existing system
- Phase 2: Migrate command palette shortcuts
- Phase 3: Auto-register all command shortcuts
- Phase 4: Remove @solid-primitives/keyboard dependency

---

## Sidebar Layout Enhancement

**Priority:** Could (Future)

### Current State

Fixed-width sidebar (w-64, 256px):

- ⚠️ No user control over width
- ⚠️ May be too narrow for long paths
- ⚠️ May be too wide for simple projects

### Proposed: Use Ark UI Splitter

**Benefits:**

- User-resizable sidebar
- Consistent with SplitView (already using Splitter)
- Better UX for different screen sizes
- State persistence (store width in LocalStorage)

**Reference:** Current SplitView implementation at `src/components/Layout/SplitView.tsx:14` (using Ark UI Splitter)

### Implementation

```typescript
// src/routes/MemoPage.tsx
import { Splitter } from "@ark-ui/solid";

<Splitter.Root size={[{ id: "sidebar", size: sidebarWidth() }, { id: "content", size: 100 - sidebarWidth() }]}>
  <Splitter.Panel id="sidebar">
    <Sidebar />
  </Splitter.Panel>
  <Splitter.ResizeTrigger id="sidebar:content" />
  <Splitter.Panel id="content">
    {/* Main content */}
  </Splitter.Panel>
</Splitter.Root>;
```

**State Management:**

```typescript
const [sidebarWidth, setSidebarWidth] = createStorageSignal<number>("noir:sidebarWidth", 20); // 20% default
```

---

## Editor Tab Key Behavior

**Priority:** Should (Future)

### Problem

When focused in the editor, pressing `Tab` moves focus away from the editor instead of performing editor actions (e.g., indenting lists).

### Solution

- Prevent default Tab behavior when editor has focus
- Let CodeMirror handle Tab key internally for:
  - List indentation
  - Code block indentation
  - Auto-completion selection

### Implementation

- Add `tabindex` management to editor component
- Configure CodeMirror to handle Tab key
- Prevent focus loss on Tab press when editor is active

---

## Command Palette Enhancement

**Priority:** Should (Phase 5.5)

### Current Status

The basic command palette is implemented but has limitations:

- ✅ Opens with Cmd+K/Ctrl+K
- ✅ Searches and executes registered commands
- ⚠️ Only searches commands, not pages
- ⚠️ No page content preview
- ⚠️ Uses plain HTML instead of Ark UI components
- ⚠️ Command shortcuts defined but not auto-registered

### Proposed Enhancements

#### 1. Unified Search (Commands + Pages)

**Feature:** Search both commands and pages simultaneously

```typescript
interface PaletteItem {
  type: "command" | "page";
  id: string;
  label: string;
  description?: string;
  preview?: string; // First 2-3 lines for pages
  icon?: string; // '⚡' for commands, '📄' for pages
}
```

**UX:**

- Default: Show both commands and pages
- Prefix `>` to filter commands only (optional)
- Show type badge/icon to differentiate

#### 2. Page Content Preview

**Feature:** Display snippet of page content in search results

**Implementation:**

- Extract first 2-3 lines (excluding frontmatter if present)
- Show as secondary text below page path
- Highlight search query matches
- Use first H1 as title if available, else use path

```typescript
const getPagePreview = (content: string, maxLines = 2): string => {
  const lines = content.split("\n").filter((l) => l.trim());
  return lines.slice(0, maxLines).join(" ").substring(0, 100) + "...";
};
```

#### 3. Ark UI Integration

**Feature:** Replace custom dialog with Ark UI components

**Benefits:**

- Better accessibility (ARIA labels, focus management)
- Improved keyboard navigation
- Consistent styling
- Less custom code to maintain

**Components to use:**

- `Dialog` for modal overlay
- `Combobox` for searchable dropdown
- Built-in filtering and selection logic

**Reference:** https://ark-ui.com/solid/docs/components/combobox

```typescript
import { Dialog, Combobox } from "@ark-ui/solid";

// Use Combobox.Root, Combobox.Input, Combobox.Content, etc.
```

#### 4. Auto-Register Command Shortcuts

**Feature:** Automatically register keyboard shortcuts when commands are registered

**Current Issue:**

- Commands define shortcuts in metadata: `{ shortcut: ["Mod", "\\"] }`
- But these are not actually registered with `createShortcut()`
- Only Cmd+K is registered (palette.tsx:28-36)

**Solution:**

```typescript
// src/commands/registry.ts
class CommandRegistryImpl {
  private shortcuts: Map<string, () => void> = new Map();

  register(command: Command, context?: CommandContext): void {
    this.commands.set(command.id, command);

    // Auto-register shortcut if defined
    if (command.shortcut && context) {
      const handler = (e: KeyboardEvent) => {
        e?.preventDefault();
        void this.execute(command.id, context);
      };

      createShortcut(command.shortcut, handler);
      this.shortcuts.set(command.id, handler);
    }
  }

  // Clean up shortcuts when unregistering
  unregister(commandId: string): void {
    this.shortcuts.delete(commandId);
    this.commands.delete(commandId);
  }
}
```

**Note:** This requires passing `CommandContext` to `register()`, which may need to be created at the app level and passed down.

### Implementation Steps

1. **Step 1:** Migrate to Ark UI Dialog + Combobox
   - Replace current custom dialog in `palette.tsx`
   - Maintain current search functionality

2. **Step 2:** Add page search
   - Create `searchPages()` function using memoStore
   - Merge command and page results
   - Add type badges/icons

3. **Step 3:** Add page preview
   - Extract preview text from memo content
   - Display as secondary text in results
   - Consider extracting title from first H1

4. **Step 4:** Auto-register shortcuts
   - Modify CommandRegistry to accept context
   - Auto-call createShortcut() when command has shortcut field
   - Handle cleanup on unregister

5. **Step 5:** Polish UX
   - Highlight query matches
   - Recent items / MRU list
   - Command categories

### Testing

- [ ] Cmd+K opens palette
- [ ] Can search and find pages by path or content
- [ ] Can search and find commands by label
- [ ] Page results show 2-3 line preview
- [ ] Selecting page navigates to it
- [ ] Selecting command executes it
- [ ] Cmd+\ toggles view mode (auto-registered)
- [ ] Cmd+Shift+B toggles sidebar (auto-registered)
- [ ] Escape closes palette
- [ ] Arrow keys navigate results
- [ ] Enter selects highlighted item

---

## Implementation Priority

### Current Phase: 5.5 - UX Improvements

1. **Phase 1-5**: Complete ✅
   - ✅ Tree utility bug fix (root memo now displays)
   - ✅ Tree utility tests implemented
2. **Phase 5.5**: UX Improvements - **Current Priority**
   - **5.5a**: UI State Persistence (LocalStorage only, simplified) - **Recommended First**
   - **5.5b**: Command Palette Enhancement (Ark UI, page search, preview)
3. **Phase 6**: Tab Synchronization
4. **Phase 7**: Testing & Polish
5. **Future Enhancements**:
   - Frontmatter Metadata Support
   - TanStack Hotkeys migration
   - Sidebar resizing with Splitter
   - Editor Tab Key Behavior

### Recent Updates (2026-04-15)

- ✅ Fixed root memo (`/`) not displaying in tree sidebar
- ✅ Implemented comprehensive tests for tree utilities (15 tests passing)
- 📝 Simplified UI state persistence strategy (LocalStorage only, no SearchParams)
- 📝 Documented TanStack Hotkeys migration plan
- 📝 Documented Sidebar Splitter enhancement plan

### Why 5.5a Before 5.5b?

**UI State Persistence should come first** because:

1. It's a core UX issue affecting daily usage
2. Much simpler now (LocalStorage only, no URL juggling)
3. Unlocks better navigation patterns for command palette
4. Can be implemented quickly
