import { useLocation, useNavigate } from "@solidjs/router";
import { createHotkey } from "@tanstack/solid-hotkeys";
import {
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  type ParentComponent,
  useContext,
} from "solid-js";

import { allCommands } from "../commands/definitions";
import type { Command, CommandContext } from "../commands/types";
import { normalizePath } from "../utils/path";
import { useEditorSplit } from "./editorSplit";

/**
 * Commands context value
 */
interface CommandsContextValue {
  commands: Accessor<Command[]>;
  commandContext: Accessor<CommandContext>;
  executeCommand: (commandId: string) => Promise<boolean>;
  searchCommands: (query: string) => Command[];
  paletteOpen: Accessor<boolean>;
  setPaletteOpen: (open: boolean) => void;
}

const CommandsContext = createContext<CommandsContextValue>();

/**
 * Search commands by query
 */
function searchCommandsImpl(commands: Command[], query: string): Command[] {
  const lowerQuery = query.toLowerCase();
  return commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(lowerQuery) ||
      cmd.description?.toLowerCase().includes(lowerQuery) ||
      cmd.category?.toLowerCase().includes(lowerQuery),
  );
}

/**
 * Execute a command by ID
 */
async function executeCommandImpl(
  commands: Command[],
  commandId: string,
  context: CommandContext,
): Promise<boolean> {
  const command = commands.find((cmd) => cmd.id === commandId);
  if (!command) {
    console.warn(`Command not found: ${commandId}`);
    return false;
  }

  if (command.isEnabled && !command.isEnabled(context)) {
    console.warn(`Command disabled: ${commandId}`);
    return false;
  }

  try {
    await command.execute(context);
    return true;
  } catch (error) {
    console.error(`Command execution failed: ${commandId}`, error);
    return false;
  }
}

/**
 * Commands provider component
 */
export const CommandsProvider: ParentComponent = (props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const editorSplitter = useEditorSplit();

  // Command registry
  const [commands] = createSignal<Command[]>(allCommands);

  // Command palette state
  const [paletteOpen, setPaletteOpen] = createSignal(false);

  // Create reactive CommandContext
  const commandContext = createMemo<CommandContext>(() => ({
    currentPath: normalizePath(location.pathname),
    navigate: (path: string) => navigate(path),
    setMode: (mode) => {
      const api = editorSplitter();
      if (!api) return;
      const sidebarSize = api.getSizes()[0];
      switch (mode) {
        case "edit":
          api.setSizes([sidebarSize, 100 - sidebarSize, 0]);
          break;
        case "preview":
          api.setSizes([sidebarSize, 0, 100 - sidebarSize]);
          break;
        case "split":
          api.setSizes([sidebarSize, 50 - sidebarSize / 2, 50 - sidebarSize / 2]);
          break;
      }
    },
    toggleSidebar: () => {
      const api = editorSplitter();
      if (!api) return;
      const sizes = api.getSizes();
      const closed = sizes[0] === 0;
      if (closed) {
        const newSidebarSize = 20;
        api.setSizes([newSidebarSize, sizes[1], sizes[2]]);
      } else {
        api.setSizes([0, sizes[1], sizes[2]]);
      }
    },
  }));

  // Register keyboard shortcuts for all commands
  for (const cmd of allCommands) {
    if (cmd.shortcut) {
      // Join shortcut array with "+" to create Hotkey string (e.g., ["Mod", "1"] -> "Mod+1")
      // Type assertion is safe here because command shortcuts are defined with correct format
      const shortcutStr = cmd.shortcut.join("+") as Parameters<typeof createHotkey>[0];
      createHotkey(shortcutStr, (e) => {
        e?.preventDefault();
        void executeCommandImpl(commands(), cmd.id, commandContext());
      });
    }
  }

  // Register command palette toggle (Cmd+K / Ctrl+K)
  createHotkey("Mod+K", (e) => {
    e?.preventDefault();
    setPaletteOpen((prev) => !prev);
  });

  // Context value
  const value: CommandsContextValue = {
    commands,
    commandContext,
    executeCommand: (commandId: string) =>
      executeCommandImpl(commands(), commandId, commandContext()),
    searchCommands: (query: string) => searchCommandsImpl(commands(), query),
    paletteOpen,
    setPaletteOpen,
  };

  return <CommandsContext.Provider value={value}>{props.children}</CommandsContext.Provider>;
};

/**
 * Hook to access all commands
 */
export function useCommands(): Accessor<Command[]> {
  const context = useContext(CommandsContext);
  if (!context) {
    throw new Error("useCommands must be used within CommandsProvider");
  }
  return context.commands;
}

/**
 * Hook to access command context
 */
export function useCommandContext(): Accessor<CommandContext> {
  const context = useContext(CommandsContext);
  if (!context) {
    throw new Error("useCommandContext must be used within CommandsProvider");
  }
  return context.commandContext;
}

/**
 * Hook to execute commands
 */
export function useCommandExecution() {
  const context = useContext(CommandsContext);
  if (!context) {
    throw new Error("useCommandExecution must be used within CommandsProvider");
  }
  return {
    executeCommand: context.executeCommand,
    searchCommands: context.searchCommands,
  };
}

/**
 * Hook to access command palette state
 */
export function useCommandPalette() {
  const context = useContext(CommandsContext);
  if (!context) {
    throw new Error("useCommandPalette must be used within CommandsProvider");
  }
  return {
    isOpen: context.paletteOpen,
    setOpen: context.setPaletteOpen,
  };
}
