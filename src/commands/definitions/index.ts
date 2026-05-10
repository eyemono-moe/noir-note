import type { Command } from "../types";
import { attachmentCommands } from "./attachments";
import { editorCommands } from "./editor";
import { helpCommands } from "./help";
import { insertionCommands } from "./insertion";
import { navigationCommands } from "./navigation";
import { themeCommands } from "./theme";
import { viewCommands } from "./view";

export const allCommands: Command[] = [
  ...navigationCommands,
  ...viewCommands,
  ...editorCommands,
  ...insertionCommands,
  ...themeCommands,
  ...attachmentCommands,
  ...helpCommands,
];

export * from "./attachments";
export * from "./editor";
export * from "./help";
export * from "./insertion";
export * from "./navigation";
export * from "./theme";
export * from "./view";
