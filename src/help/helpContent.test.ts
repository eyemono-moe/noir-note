import { describe, expect, test } from "vite-plus/test";

import { helpCommands } from "../commands/definitions/help";
import { HELP_DIALOG_TITLE, HELP_MARKDOWN_CONTENT } from "./helpContent";

describe("help usage guide", () => {
  test("ships non-empty bundled markdown for first-time users", () => {
    expect(HELP_DIALOG_TITLE).toBe("Help / Usage Guide");
    expect(HELP_MARKDOWN_CONTENT).toContain("# Help / Usage Guide");
    expect(HELP_MARKDOWN_CONTENT).toContain("Command Palette");
    expect(HELP_MARKDOWN_CONTENT).toContain("Images and attachments");
  });

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
    });

    expect(opened).toBe(true);
  });
});
