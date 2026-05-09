import type { Command } from "../types";

const openUsageGuideCommand: Command = {
  id: "help-open-usage-guide",
  label: "Help: Open Usage Guide",
  description: "Open the built-in usage guide without leaving the current note",
  category: "help",
  execute: (context) => {
    context.openHelp();
  },
};

export const helpCommands: Command[] = [openUsageGuideCommand];
