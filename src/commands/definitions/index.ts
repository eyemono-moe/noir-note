import type { Command } from "../types";
import { navigationCommands } from "./navigation";
import { viewCommands } from "./view";

export const allCommands: Command[] = [...navigationCommands, ...viewCommands];

export * from "./navigation";
export * from "./view";
