import type { Command, CommandContext, CommandRegistry } from "./types";

class CommandRegistryImpl {
  private commands: CommandRegistry = new Map();

  register(command: Command): void {
    this.commands.set(command.id, command);
  }

  unregister(commandId: string): void {
    this.commands.delete(commandId);
  }

  get(commandId: string): Command | undefined {
    return this.commands.get(commandId);
  }

  getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  search(query: string): Command[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lowerQuery) ||
        cmd.description?.toLowerCase().includes(lowerQuery) ||
        cmd.category?.toLowerCase().includes(lowerQuery),
    );
  }

  async execute(commandId: string, context: CommandContext): Promise<boolean> {
    const command = this.get(commandId);
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
}

// Singleton instance
export const commandRegistry = new CommandRegistryImpl();
