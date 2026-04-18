import type { Command } from "../types";
import { navigationCommands } from "./navigation";
import { themeCommands } from "./theme";
import { viewCommands } from "./view";

export const allCommands: Command[] = [...navigationCommands, ...viewCommands, ...themeCommands];

export * from "./navigation";
export * from "./theme";
export * from "./view";
