import type { Command } from "../types";

const changeModeCommand: Command = {
  id: "change-mode",
  label: "Change View Mode",
  description: "Switch between Edit, Preview, and Split modes",
  shortcut: ["Mod", "\\"],
  category: "view",
  execute: async (context) => {
    context.setMode((prevMode) => {
      if (prevMode === "edit") return "preview";
      if (prevMode === "preview") return "split";
      return "edit";
    });
  },
};

const toggleSidebarCommand: Command = {
  id: "toggle-sidebar",
  label: "Toggle Sidebar",
  description: "Show or hide the page tree sidebar",
  shortcut: ["Mod", "Shift", "B"],
  category: "view",
  execute: (context) => {
    context.toggleSidebar();
  },
};

export const viewCommands: Command[] = [changeModeCommand, toggleSidebarCommand];
