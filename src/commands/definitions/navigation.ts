import type { Command } from "../types";

const navigateCommand: Command = {
  id: "navigate",
  label: "Navigate to Page",
  description: "Jump to a specific page by path",
  category: "navigation",
  execute: async () => {
    // This will be triggered from command palette with user input
    // The actual navigation logic will be handled by the palette component
  },
};

const goHomeCommand: Command = {
  id: "go-home",
  label: "Go to Home",
  description: "Navigate to root page",
  shortcut: ["Mod", "Shift", "H"],
  category: "navigation",
  execute: (context) => {
    context.navigate("/");
  },
};

export const navigationCommands: Command[] = [navigateCommand, goHomeCommand];
