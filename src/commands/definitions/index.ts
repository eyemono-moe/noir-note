import type { Command } from "../types";
import { attachmentCommands } from "./attachments";
import { navigationCommands } from "./navigation";
import { themeCommands } from "./theme";
import { viewCommands } from "./view";

export const allCommands: Command[] = [
  ...navigationCommands,
  ...viewCommands,
  ...themeCommands,
  ...attachmentCommands,
];

export * from "./attachments";
export * from "./navigation";
export * from "./theme";
export * from "./view";
