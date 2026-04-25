import { updateScrollSyncEnabled, useConfig } from "../../store/configStore";
import type { Command } from "../types";

const editModeCommand: Command = {
  id: "view-mode-edit",
  label: "View: Edit Mode",
  description: "Switch to edit-only view",
  shortcut: "Mod+1",
  category: "view",
  execute: (context) => {
    context.setMode("edit");
  },
};

const splitModeCommand: Command = {
  id: "view-mode-split",
  label: "View: Split Mode",
  description: "Switch to split view (edit + preview)",
  shortcut: "Mod+2",
  category: "view",
  execute: (context) => {
    context.setMode("split");
  },
};

const previewModeCommand: Command = {
  id: "view-mode-preview",
  label: "View: Preview Mode",
  description: "Switch to preview-only view",
  shortcut: "Mod+3",
  category: "view",
  execute: (context) => {
    context.setMode("preview");
  },
};

const toggleSidebarCommand: Command = {
  id: "toggle-sidebar",
  label: "Toggle Sidebar",
  description: "Show or hide the page tree sidebar",
  shortcut: "Mod+Shift+B",
  category: "view",
  execute: (context) => {
    context.toggleSidebar();
  },
};

const toggleScrollSyncCommand: Command = {
  id: "toggle-scroll-sync",
  label: "Toggle Scroll Sync",
  description: "Enable or disable scroll synchronisation between editor and preview",
  category: "view",
  execute: () => {
    const [config] = useConfig();
    updateScrollSyncEnabled(!(config().scrollSyncEnabled ?? true));
  },
};

export const viewCommands: Command[] = [
  editModeCommand,
  splitModeCommand,
  previewModeCommand,
  toggleSidebarCommand,
  toggleScrollSyncCommand,
];
