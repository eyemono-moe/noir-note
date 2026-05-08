import type { Command } from "../types";
import { attachmentCommands } from "./attachments";
import { editorCommands } from "./editor";
import { navigationCommands } from "./navigation";
import { themeCommands } from "./theme";
import { viewCommands } from "./view";

export const allCommands: Command[] = [
  ...navigationCommands,
  ...viewCommands,
  ...editorCommands,
  ...themeCommands,
  ...attachmentCommands,
];

export * from "./attachments";
export * from "./navigation";
export * from "./theme";
export * from "./view";
