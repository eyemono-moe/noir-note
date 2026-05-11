import type { RegisterableHotkey } from "@tanstack/solid-hotkeys";

import type { ViewMode } from "../types/ui";
import type { InsertionSpec } from "../utils/editorInsertion";

export interface CommandContext {
  currentPath: string;
  navigate: (path: string) => void;
  openHelp: () => void;
  setMode: (mode: ViewMode) => void;
  toggleSidebar: () => void;
  openNoteSearch: () => boolean;
  /**
   * Insert text/snippet into the current editor view at the current selection
   * (or the explicit replace range when provided). Returns false when no
   * editor is currently mounted.
   */
  insertIntoEditor: (spec: InsertionSpec) => boolean;
}

export interface Command {
  id: string;
  label: string;
  description?: string;
  shortcut?: RegisterableHotkey;
  category?: string;
  execute: (context: CommandContext) => void | Promise<void>;
  isEnabled?: (context: CommandContext) => boolean;
}

// Unified palette item type for commands and pages
type PaletteItemType = "command" | "page";

export interface PaletteItem {
  type: PaletteItemType;
  value: string; // Unique identifier (command.id or page path)
  label: string;
  description?: string;
  preview?: string; // For pages: content preview
  tags?: string[]; // For pages: metadata tags
  shortcut?: RegisterableHotkey; // Keyboard shortcut for commands
  category?: string;
}

export interface PageSearchResult {
  path: string;
  title: string;
  preview: string;
}
