import { describe, expect, test } from "vite-plus/test";

import { getMemoDocumentTitle } from "./documentTitle";

describe("getMemoDocumentTitle", () => {
  test("returns the app name for root path", () => {
    expect(getMemoDocumentTitle("/")).toBe("eyemono.md");
    expect(getMemoDocumentTitle("")).toBe("eyemono.md");
  });

  test("uses the note path when no frontmatter title exists", () => {
    expect(getMemoDocumentTitle("notes/today.md")).toBe("/notes/today.md — eyemono.md");
  });

  test("prefers the frontmatter title over the path", () => {
    expect(getMemoDocumentTitle("/notes/today.md", "Today")).toBe("Today — eyemono.md");
  });

  test("falls back to the path when the frontmatter title is blank", () => {
    expect(getMemoDocumentTitle("/notes/today.md", "   ")).toBe("/notes/today.md — eyemono.md");
  });
});
