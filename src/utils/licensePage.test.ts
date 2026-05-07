import { describe, expect, test } from "vite-plus/test";

import {
  APP_HOME_PATH,
  LICENSE_MARKDOWN_PATH,
  LICENSE_PAGE_PATH,
  loadLicenseMarkdown,
} from "./licensePage";

describe("license page navigation", () => {
  test("uses an in-app route with a home return path instead of the raw markdown URL", () => {
    expect(LICENSE_PAGE_PATH).toBe("/licenses");
    expect(APP_HOME_PATH).toBe("/");
    expect(LICENSE_PAGE_PATH).not.toBe(LICENSE_MARKDOWN_PATH);
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
