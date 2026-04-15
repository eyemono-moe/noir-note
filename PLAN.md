# Noir Notes - Implementation Plan

## Overview

Building a minimal memo application with Notion-like hierarchical structure, URL-based routing, CodeMirror editor, and command palette interface.

## Current State (Updated: 2026-04-15)

- ✅ Phase 1-5 Complete: Full memo app with CodeMirror editor, view modes, command system, and tree sidebar
- 🔄 Phase 4 Partially Complete: Command palette works, but keyboard shortcuts not auto-registered
- ⏳ Phase 6-7 Pending: Tab synchronization and testing not yet implemented
- 📦 Dependencies: SolidJS 1.9.12, @ark-ui/solid 5.36.0, CodeMirror 6.x, marked 18.0.0

## Dependencies to Add

```bash
vp add @solidjs/router solid-codemirror @codemirror/state @codemirror/view @codemirror/lang-markdown @codemirror/commands @codemirror/language @codemirror/autocomplete marked idb
vp add -D @solid-primitives/keyboard @solid-primitives/storage @solid-primitives/event-listener
```

## Directory Structure

```
src/
├── commands/               # Command system
│   ├── registry.ts        # Command registration & execution
│   ├── palette.tsx        # Command palette UI
│   ├── definitions/       # Command implementations
│   └── types.ts           # Command interfaces
│
├── components/            # UI components
│   ├── Editor/           # CodeMirror wrapper
│   ├── Preview/          # Markdown preview
│   ├── Layout/           # Split view, containers
│   └── Sidebar/          # Tree sidebar
│
├── editor/               # CodeMirror extensions
│   ├── extensions.ts    # Bundle all extensions
│   ├── markdown.ts      # Markdown config
│   ├── listCompletion.ts # Auto-complete for lists
│   ├── theme.ts         # Monochrome theme
│   └── keymap.ts        # Editor keybindings
│
├── routes/              # Route components
│   └── MemoPage.tsx     # Main memo page (all paths)
│
├── store/               # SolidJS stores
│   ├── memoStore.ts    # Memo data (createStore)
│   ├── uiStore.ts      # UI state (mode, sidebar)
│   ├── treeStore.ts    # Page hierarchy
│   └── syncStore.ts    # Tab sync state
│
├── storage/             # Storage abstraction
│   ├── interface.ts    # IStorage interface
│   ├── indexeddb.ts    # IndexedDB implementation
│   ├── memory.ts       # In-memory (testing)
│   └── index.ts        # Factory
│
├── sync/                # Tab synchronization
│   ├── broadcast.ts    # BroadcastChannel wrapper
│   ├── syncManager.ts  # Sync coordination
│   └── types.ts        # Sync message types
│
├── types/               # Type definitions
│   ├── memo.ts         # Memo, MemoMetadata
│   ├── ui.ts           # ViewMode, UIState
│   └── storage.ts      # Storage types
│
└── utils/               # Utilities
    ├── path.ts         # Path manipulation
    ├── tree.ts         # Build tree from flat list
    ├── debounce.ts     # Debounce utility
    └── constants.ts    # App constants
```

## Implementation Phases

### Phase 1: Foundation

**Goal:** Core routing, storage, and state management

1. Install dependencies
2. Create storage interface (`src/storage/interface.ts`)
   - `IStorage` interface with get/set/delete/list/clear
   - `Memo` type with path, content, createdAt, updatedAt
3. Implement IndexedDB storage (`src/storage/indexeddb.ts`)
   - Use `idb` library
   - Database: "noir-notes", Store: "memos"
4. Create stores (`src/store/memoStore.ts`, `src/store/uiStore.ts`)
   - memoStore: Map of path -> Memo using createStore
   - uiStore: viewMode, sidebarVisible using createSignal
5. Setup routing (`src/index.tsx`)
   - Configure @solidjs/router with catch-all route
   - Pass storage to app context
6. Create MemoPage component (`src/routes/MemoPage.tsx`)
   - Read path from useParams()
   - Read mode/sidebar from useSearchParams()
   - Load memo from storage
   - Basic textarea for editing

**Validation:** Navigate to /foo, type content, refresh browser, content persists

### Phase 2: Editor Integration

**Goal:** CodeMirror with Markdown support

1. Create Editor component (`src/components/Editor/Editor.tsx`)
   - Use solid-codemirror's createCodeMirror
   - Wire to memoStore for content
2. Setup extensions (`src/editor/extensions.ts`)
   - Import markdown() from @codemirror/lang-markdown
   - Create monochrome theme using EditorView.theme()
3. Implement list completion (`src/editor/listCompletion.ts`)
   - Auto-insert `- ` or `1. ` on new line after list items
   - Use autocompletion extension
4. Add debounced auto-save
   - Use debounce utility
   - Save to storage on content change
5. Replace textarea with Editor in MemoPage

**Validation:** Edit markdown with syntax highlighting, auto-save works, list completion works

### Phase 3: View Modes & Preview

**Goal:** edit/preview/split modes

1. Create MarkdownPreview component (`src/components/Preview/MarkdownPreview.tsx`)
   - Use marked to parse markdown
   - Sanitize HTML output
   - Apply monochrome styles
2. Create SplitView component (`src/components/Layout/SplitView.tsx`)
   - CSS Grid: two equal columns
   - Left: Editor, Right: Preview
3. Update MemoPage to render based on mode param
   - mode=edit: Editor only
   - mode=preview: Preview only
   - mode=split: SplitView with both
4. Style for monochrome theme

**Validation:** Navigate to /?mode=split shows split view, /?mode=preview shows preview only

### Phase 4: Command System ✅ (Partially Complete)

**Goal:** Command palette with Cmd+K

**Status:**

- ✅ Command types and registry implemented
- ✅ Basic palette UI with search
- ✅ Cmd+K shortcut working
- ✅ Navigation and view commands defined
- ⚠️ **Remaining Issues:**
  - Individual command shortcuts (Cmd+\, Cmd+Shift+B) not auto-registered
  - Need shortcut registration system in CommandRegistry
  - Palette uses plain HTML instead of Ark UI components

**Completed:**

1. ✅ Command types (`src/commands/types.ts`)
2. ✅ CommandRegistry (`src/commands/registry.ts`)
3. ✅ Basic palette UI (`src/commands/palette.tsx`)
4. ✅ Cmd+K shortcut with @solid-primitives/keyboard
5. ✅ Navigation and view commands (`src/commands/definitions/`)

**Validation:** Press Cmd+K, palette opens, can search and execute commands

### Phase 5: Tree Sidebar ✅ (Complete)

**Goal:** Page hierarchy viewer

**Status:** Fully implemented and working

**Completed:**

1. ✅ Tree builder (`src/utils/tree.ts`)
2. ✅ TreeStore (`src/store/treeStore.ts`)
3. ✅ Sidebar component (`src/components/Sidebar/Sidebar.tsx`)
4. ✅ TreeItem component with recursive rendering (`src/components/Sidebar/TreeItem.tsx`)
5. ✅ Integrated into MemoPage layout

**Validation:** Navigate to /?sidebar=tree, see page hierarchy, click to navigate

### Phase 5.5: Enhanced Command Palette (Proposed)

**Goal:** Unified search for both commands and pages with Ark UI

**Current Issues:**

1. Command palette only searches commands, not pages
2. No preview of page content when searching
3. Using plain HTML instead of Ark UI components
4. Command shortcuts not auto-registered from metadata

**Proposed Enhancements:**

1. **Dual-mode search:**
   - Type to search both commands AND pages
   - Show icon/badge to differentiate (📄 page vs ⚡ command)
   - Filter by prefix: `>` for commands, no prefix for pages/all

2. **Page preview:**
   - Show first 2-3 lines of page content in search results
   - Extract title from first heading or use path

3. **Ark UI integration:**
   - Replace custom dialog with Ark UI Dialog + Combobox
   - Better accessibility and keyboard navigation
   - Consistent styling with design system

4. **Auto-register shortcuts:**
   - CommandRegistry.register() should check for `shortcut` field
   - Automatically call createShortcut() for each command
   - Centralized shortcut management

**Implementation Structure:**

```typescript
// src/commands/palette.tsx
interface PaletteItem {
  type: "command" | "page";
  id: string;
  label: string;
  description?: string;
  preview?: string; // For pages
  icon?: string;
}

// Merge commands and pages in search
const searchItems = () => {
  const commands = commandRegistry.search(query());
  const pages = searchPages(query()); // From memoStore
  return [...commands, ...pages];
};
```

**Validation:**

- Press Cmd+K → searches both commands and pages
- Type "home" → shows both "Go Home" command and "/home" page with preview
- Select page → navigates to it
- Select command → executes it
- All command shortcuts (Cmd+\, Cmd+Shift+B, etc.) work globally

### Phase 5.5a: UI State Persistence ⚠️ (Recommended Priority)

**Goal:** Fix state loss on navigation + simplify state management

**Current Problems:**

1. Clicking sidebar links loses `?mode=split&sidebar=tree`
2. Markdown preview links lose UI state
3. Duplicate state: searchParams + uiStore (redundant)
4. setSearchParams() scattered across MemoPage.tsx
5. No user preference persistence across sessions

**Solution: Hybrid Approach (LocalStorage + SearchParams)**

- LocalStorage: remember user preferences (default mode/sidebar state)
- SearchParams: allow URL sharing (`?mode=split`)
- SearchParams override LocalStorage when present
- Navigate preserves current state automatically

**Key Implementation:**

1. Create `src/hooks/useUIState.ts`
   - `createStorageSignal()` for mode/sidebar preferences
   - Computed values that check searchParams first, then storage
   - `createNavigateWithState()` helper that appends current UI params

2. Simplify MemoPage.tsx
   - Replace searchParams logic with useUIState hook
   - Use `navigateWithState` for all navigation
   - Remove redundant uiStore updates

3. Update MarkdownPreview
   - Intercept internal link clicks
   - Use navigateWithState for internal links
   - Add target="\_blank" for external links

4. Update Sidebar
   - Receive navigateWithState as prop
   - All tree item clicks preserve state

**Benefits:**

- ✅ State persists across navigation
- ✅ User preferences remembered after browser restart
- ✅ URLs shareable with specific modes
- ✅ Centralized state management (one source of truth)
- ✅ Simpler code (no manual searchParams manipulation)

**Validation:**

- Navigate via sidebar → mode and sidebar state preserved
- Click markdown link → state preserved
- Refresh page → state restored from localStorage
- Open `/?mode=split&sidebar=tree` → overrides defaults
- Close and reopen browser → preferences remembered

### Phase 6: Tab Synchronization

**Goal:** Real-time sync across tabs

1. Create BroadcastChannel wrapper (`src/sync/broadcast.ts`)
   - send(), onMessage()
   - Message types: memo-updated, memo-deleted
2. Integrate with memoStore
   - Broadcast on save/delete
   - Listen and update store on receive
3. Prevent circular updates
   - Track update source
   - Don't broadcast if from sync
4. Use @solid-primitives/event-listener for cleanup

**Validation:** Open two tabs, edit in one, see update in other

### Phase 7: Testing & Polish

**Goal:** Tests and UX improvements

1. Storage tests (`src/storage/*.test.ts`)
   - Use memory storage for tests
   - Test CRUD operations
2. Command registry tests (`src/commands/registry.test.ts`)
   - Test registration and execution
3. Tree builder tests (`src/utils/tree.test.ts`)
   - Test hierarchy building
4. Add loading states
   - Show loading while fetching memo
5. Handle edge cases
   - Empty state (no memos)
   - 404 handling
   - Errors (storage failures)
6. Performance optimization
   - Memoize expensive computations
   - Virtual scrolling if needed

**Validation:** Run `vp test`, all tests pass

## Critical Files

1. **src/storage/interface.ts** - Storage contract, defines IStorage and Memo types
2. **src/storage/indexeddb.ts** - Primary persistence implementation
3. **src/store/memoStore.ts** - Central state management
4. **src/index.tsx** - App entry point with routing
5. **src/routes/MemoPage.tsx** - Main route orchestrating all features
6. **src/commands/registry.ts** - Command system core
7. **src/components/Editor/Editor.tsx** - CodeMirror integration
8. **src/editor/extensions.ts** - Editor configuration

## Key Architectural Patterns

### Storage Abstraction

```typescript
// All storage access through interface
interface IStorage {
  get(path: string): Promise<Memo | null>;
  set(path: string, content: string): Promise<void>;
  delete(path: string): Promise<void>;
  list(): Promise<Memo[]>;
}
```

### Command System

```typescript
// Commands as objects
interface Command {
  id: string;
  label: string;
  shortcut?: string[];
  execute: (ctx: CommandContext) => void;
}

// Single registry
registry.register({ id: "nav", execute: (ctx) => ctx.navigate("/") });
```

### URL-Based State

```typescript
// URL = source of truth
const mode = searchParams.mode || "edit";
const showSidebar = searchParams.sidebar === "tree";
```

## Design Decisions

1. **marked over remark** - Lighter weight as per spec (※軽量優先)
2. **IStorage interface** - Enables testing (memory storage) and future backends
3. **Command objects** - Centralized, searchable, testable actions
4. **URL params for UI state** - Shareable, history-friendly, no extra state
5. **IndexedDB over localStorage** - Better capacity and performance for large memos
6. **solid-primitives** - Keyboard shortcuts, storage helpers, event listeners

## Potential Challenges

1. **CodeMirror sync loops** - Mitigate with createEditorControlledValue, debouncing
2. **BroadcastChannel races** - Use timestamp-based last-write-wins
3. **IndexedDB unavailable** - Fallback to memory storage with warning
4. **Large document perf** - Debounce preview updates, consider virtual scrolling
5. **Path normalization** - Utility functions to ensure consistent path format

## Verification Steps

After implementation:

1. Start dev server: `vp dev`
2. Navigate to / - should load root memo
3. Type content - should auto-save
4. Refresh - content persists
5. Navigate to /foo/bar - creates new memo
6. Press Cmd+K - command palette opens
7. Navigate to /?mode=split - see editor + preview
8. Navigate to /?sidebar=tree - see page hierarchy
9. Open second tab - changes sync in real-time
10. Run tests: `vp test` - all pass
11. Run checks: `vp check` - no errors

## Future Enhancements

### Command Palette Improvements

**Priority:** Should

1. **TanStack Hotkeys Migration**
   - Replace `@solid-primitives/keyboard` with `@tanstack/solid-hotkeys`
   - Benefits: Better scope management, conflict detection, more intuitive API
   - Auto-register command shortcuts from metadata
   - Reference: https://tanstack.com/hotkeys/latest/docs/overview

2. **Fuzzy Search**
   - Implement fuzzy matching for command/page search
   - Library options: Fuse.js, match-sorter
   - Improves discoverability (typo tolerance, partial matches)

3. **MRU (Most Recently Used) List**
   - Track recently accessed pages and commands
   - Show MRU items when palette opens with empty query
   - Persist in LocalStorage
   - Implementation:
     ```typescript
     interface MRU {
       type: "command" | "page";
       value: string;
       lastAccessed: number;
     }
     // Show top 5 MRU items by default
     ```

4. **Search Result Highlighting**
   - Highlight matching text in search results
   - Visual feedback for query matches
   - Use mark.js or custom implementation

### memoStore Architecture Refactoring

**Priority:** Must (Technical Debt)

**Current Issues:**

1. Using `Map` in SolidJS store is not reactive
2. Imperative loading in MemoPage breaks reactivity model
3. Memo list should be derived from IStorage state, not manually managed

**Proposed Solution: Use `createResource`**

```typescript
// src/store/memoStore.ts - Refactored approach
export const createMemoResource = (storage: IStorage) => {
  const [memos] = createResource(async () => {
    return await storage.list();
  });

  const getMemo = (path: string) => {
    return createResource(
      () => path,
      async (p) => await storage.get(p),
    );
  };

  const saveMemo = async (path: string, content: string) => {
    await storage.set(path, content);
    // Automatically refetch on save
    refetch();
  };

  return { memos, getMemo, saveMemo };
};
```

**Benefits:**

- ✅ Fully reactive: UI updates automatically when storage changes
- ✅ Declarative: No imperative `loadAll()` calls
- ✅ Loading states: Built-in with createResource
- ✅ Error handling: Built-in error boundaries
- ✅ Suspense support: Works with SolidJS Suspense

**Migration Steps:**

1. Create new `src/store/memoResource.ts` with createResource approach
2. Update MemoPage to use resource instead of store
3. Remove imperative `memoActions.loadAll()` call
4. Test reactive updates (save → auto-refetch → UI updates)
5. Deprecate old memoStore.ts

### Sidebar Enhancements

**Priority:** Could

1. **Resizable Sidebar with Splitter**
   - Use Ark UI Splitter (already used in SplitView)
   - User-controlled width
   - Persist width in LocalStorage
   - Implementation reference: `src/components/Layout/SplitView.tsx`

2. **Tree Operations**
   - Drag & drop to reorganize pages
   - Right-click context menu (rename, delete, duplicate)
   - Collapsible folders

### Testing & Quality

**Priority:** Should

1. **Comprehensive Test Coverage**
   - Storage tests (IndexedDB, memory)
   - Command registry tests
   - Tree builder tests (already implemented ✅)
   - Search utility tests (already implemented ✅)
   - UI component tests with solidjs-testing-library

2. **E2E Testing**
   - Playwright or Cypress
   - Critical user flows:
     - Create → Edit → Save memo
     - Navigate between pages
     - Command palette usage
     - Tab synchronization

### Performance Optimizations

**Priority:** Could

1. **Virtual Scrolling**
   - For large page lists in sidebar
   - For long command palette results
   - Use `@tanstack/solid-virtual`

2. **Debouncing & Throttling**
   - Already implemented for auto-save ✅
   - Add for search input
   - Optimize preview rendering

3. **Code Splitting**
   - Lazy load CodeMirror
   - Lazy load Markdown parser
   - Route-based splitting

## Recent Progress (2026-04-15)

### Phase 5.5: UX Improvements - Complete ✅

**5.5a: UI State Persistence**

- ✅ LocalStorage-only approach (simplified from hybrid)
- ✅ Created `useUIState` hook
- ✅ Removed redundant `uiStore.ts`
- ✅ State persists across navigation and browser restarts

**5.5b: Command Palette Enhancement**

- ✅ Migrated to Ark UI Combobox
- ✅ Unified search (commands + pages)
- ✅ Page preview in search results
- ✅ Icon differentiation (⚡ commands, 📄 pages)
- ✅ Implemented page search utilities with tests (21 tests passing)
- ✅ Fixed root memo display bug in tree sidebar
- ✅ Tree utility tests (15 tests passing)

## Next Steps

Current implementation status:

- ✅ **Phase 1-5**: Complete
- ✅ **Phase 5.5a**: UI State Persistence (Complete)
- ✅ **Phase 5.5b**: Command Palette Enhancement (Complete)
- ⏳ **Phase 5.5c**: memoStore Refactoring (Recommended Next)
- ⏳ **Phase 6**: Tab Synchronization
- ⏳ **Phase 7**: Testing & Polish

**Immediate Priority: memoStore Refactoring**

1. Implement createResource-based approach
2. Remove imperative loading
3. Enable full reactivity
4. Improve error handling and loading states
