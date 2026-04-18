import type { Command } from "../types";

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

export const navigationCommands: Command[] = [goHomeCommand];
