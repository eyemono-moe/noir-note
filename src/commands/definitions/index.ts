import type { Command } from "../types";
import { attachmentCommands } from "./attachments";
import { importExportCommands } from "./importExport";
import { navigationCommands } from "./navigation";
import { themeCommands } from "./theme";
import { viewCommands } from "./view";

export const allCommands: Command[] = [
  ...navigationCommands,
  ...viewCommands,
  ...themeCommands,
  ...attachmentCommands,
  ...importExportCommands,
];

export * from "./attachments";
export * from "./importExport";
export * from "./navigation";
export * from "./theme";
export * from "./view";
