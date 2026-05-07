import { describe, expect, test } from "vite-plus/test";

import { LICENSE_DIALOG_TITLE, LICENSE_MARKDOWN_PATH, loadLicenseMarkdown } from "./licensePage";

describe("license dialog content", () => {
  test("uses the generated markdown asset without reserving a memo route", () => {
    expect(LICENSE_DIALOG_TITLE).toBe("Licenses");
    expect(LICENSE_MARKDOWN_PATH).toBe("/licenses.md");
    expect(LICENSE_MARKDOWN_PATH).not.toBe("/licenses");
  });

  test("loads the generated markdown license document", async () => {
    const calls: string[] = [];
    const content = await loadLicenseMarkdown(async (input) => {
      calls.push(input instanceof Request ? input.url : input.toString());
      return new Response("# Licenses\n\nMIT");
    });

    expect(calls).toEqual([LICENSE_MARKDOWN_PATH]);
    expect(content).toBe("# Licenses\n\nMIT");
  });

  test("throws a useful error when the generated markdown document cannot be loaded", async () => {
    await expect(
      loadLicenseMarkdown(
        async () => new Response("missing", { status: 404, statusText: "Not Found" }),
      ),
    ).rejects.toThrow("Failed to load licenses.md: 404 Not Found");
  });
});
