import { describe, expect, test } from "vite-plus/test";

import { helpCommands } from "../commands/definitions/help";

describe("help usage guide", () => {
  test("registers a command palette action that opens help without routing to /help", async () => {
    let opened = false;
    const command = helpCommands.find((cmd) => cmd.id === "help-open-usage-guide");

    expect(command?.label).toBe("Help: Open Usage Guide");
    expect(command?.category).toBe("help");

    await command?.execute({
      currentPath: "/notes/today",
      navigate: () => {
        throw new Error("help command must not reserve or navigate to /help");
      },
      openHelp: () => {
        opened = true;
      },
      setMode: () => undefined,
      toggleSidebar: () => undefined,
      openNoteSearch: () => false,
      insertIntoEditor: () => false,
      openInsertionPicker: () => undefined,
    });

    expect(opened).toBe(true);
  });
});
