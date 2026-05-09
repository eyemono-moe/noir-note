import type { Command } from "../types";

const findInNoteCommand: Command = {
  id: "find-in-note",
  label: "Find in Note",
  description: "Search within the current note",
  shortcut: "Mod+F",
  category: "editor",
  execute: (context) => {
    context.openNoteSearch();
  },
};

export const editorCommands: Command[] = [findInNoteCommand];
