import type { ViewMode } from "../types/ui";

export interface CommandContext {
  currentPath: string;
  navigate: (path: string) => void;
  setMode: (mode: ViewMode) => void;
  toggleSidebar: () => void;
}

export interface Command {
  id: string;
  label: string;
  description?: string;
  shortcut?: string[];
  category?: string;
  execute: (context: CommandContext) => void | Promise<void>;
  isEnabled?: (context: CommandContext) => boolean;
}

// Unified palette item type for commands and pages
export type PaletteItemType = "command" | "page";

export interface PaletteItem {
  type: PaletteItemType;
  value: string; // Unique identifier (command.id or page path)
  label: string;
  description?: string;
  preview?: string; // For pages: content preview
  category?: string;
}

export interface PageSearchResult {
  path: string;
  title: string;
  preview: string;
}
