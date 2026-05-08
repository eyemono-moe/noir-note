import type { Command } from "../types";
import { attachmentCommands } from "./attachments";
import { helpCommands } from "./help";
import { navigationCommands } from "./navigation";
import { themeCommands } from "./theme";
import { viewCommands } from "./view";

export const allCommands: Command[] = [
  ...navigationCommands,
  ...viewCommands,
  ...themeCommands,
  ...attachmentCommands,
  ...helpCommands,
];

export * from "./attachments";
export * from "./help";
export * from "./navigation";
export * from "./theme";
export * from "./view";
