import { describe, expect, test } from "vite-plus/test";

import type { Memo } from "../types/memo";
import { extractPreview, extractTitle, searchPages } from "./search";

function createMemo(path: string, content: string, metadata?: Memo["metadata"]): Memo {
  return {
    path,
    content,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    metadata,
  };
}

describe("extractTitle", () => {
  test("extracts H1 heading", () => {
    const content = "# My Title\n\nSome content";
    expect(extractTitle("/test", content)).toBe("My Title");
  });

  test("extracts H1 with extra spaces", () => {
    const content = "#    Spaced Title   \n\nSome content";
    expect(extractTitle("/test", content)).toBe("Spaced Title");
  });

  test("falls back to first non-empty line", () => {
    const content = "\n\nFirst line of content\nSecond line";
    expect(extractTitle("/test", content)).toBe("First line of content");
  });

  test("truncates long first line", () => {
    const content = "a".repeat(100);
    const title = extractTitle("/test", content);
    expect(title).toHaveLength(53); // 50 chars + "..."
    expect(title.endsWith("...")).toBe(true);
  });

  test("falls back to path for empty content", () => {
    expect(extractTitle("/my/path", "")).toBe("/my/path");
  });

  test("ignores non-H1 headings", () => {
    const content = "## H2 heading\n\nFirst line";
    expect(extractTitle("/test", content)).toBe("## H2 heading");
  });
});

describe("extractPreview", () => {
  test("extracts first 2 lines", () => {
    const content = "# Title\nFirst line\nSecond line\nThird line";
    const preview = extractPreview(content);
    expect(preview).toBe("First line Second line");
  });

  test("skips H1 heading", () => {
    const content = "# Title\nContent line";
    const preview = extractPreview(content);
    expect(preview).toBe("Content line");
  });

  test("skips frontmatter delimiters", () => {
    const content = "---\ntitle: Test\n---\n# Heading\nContent";
    const preview = extractPreview(content);
    // Currently includes frontmatter content (minus delimiters)
    expect(preview).toBe("title: Test Content");
  });

  test("skips empty lines", () => {
    const content = "# Title\n\n\nFirst line\n\nSecond line";
    const preview = extractPreview(content);
    expect(preview).toBe("First line Second line");
  });

  test("truncates long preview", () => {
    const content = "# Title\n" + "a".repeat(150);
    const preview = extractPreview(content, 1, 100);
    expect(preview).toHaveLength(103); // 100 + "..."
    expect(preview.endsWith("...")).toBe(true);
  });

  test("returns empty for content with only heading", () => {
    const content = "# Title Only";
    expect(extractPreview(content)).toBe("");
  });
});

describe("searchPages", () => {
  const memos: Memo[] = [
    createMemo("/home", "# Home\nWelcome to my notes"),
    createMemo("/projects/web", "# Web Project\nBuilding a website"),
    createMemo("/projects/app", "# Mobile App\nCreating iOS app"),
    createMemo("/ideas", "Random thoughts\nAbout various topics"),
  ];

  test("returns empty for empty query", () => {
    expect(searchPages(memos, "")).toEqual([]);
    expect(searchPages(memos, "   ")).toEqual([]);
  });

  test("searches by path", () => {
    const results = searchPages(memos, "projects");
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.path)).toContain("/projects/web");
    expect(results.map((r) => r.path)).toContain("/projects/app");
  });

  test("searches by title", () => {
    const results = searchPages(memos, "Web");
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("/projects/web");
  });

  test("searches by content", () => {
    const results = searchPages(memos, "iOS");
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("/projects/app");
  });

  test("is case insensitive", () => {
    const results = searchPages(memos, "WELCOME");
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("/home");
  });

  test("prioritizes path matches", () => {
    const results = searchPages(memos, "app");
    // /projects/app (path match) should come before /projects/web (content match)
    expect(results[0].path).toBe("/projects/app");
  });

  test("includes preview in results", () => {
    const results = searchPages(memos, "home");
    expect(results[0].preview).toBeTruthy();
    expect(results[0].preview).toContain("Welcome");
  });

  test("includes extracted title", () => {
    const results = searchPages(memos, "web");
    expect(results[0].title).toBe("Web Project");
  });

  test("handles memos without H1", () => {
    const results = searchPages(memos, "Random");
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Random thoughts");
  });

  test("filters by a metadata tag query", () => {
    const taggedMemos = [
      createMemo("/work", "# Work", { tags: ["project", "important"] }),
      createMemo("/personal", "# Personal", { tags: ["journal"] }),
      createMemo("/untagged", "# Untagged"),
    ];

    const results = searchPages(taggedMemos, "tag:project");

    expect(results.map((result) => result.path)).toEqual(["/work"]);
  });

  test("requires all metadata tags when multiple tag queries are provided", () => {
    const taggedMemos = [
      createMemo("/work", "# Work", { tags: ["project", "important"] }),
      createMemo("/side", "# Side", { tags: ["project"] }),
    ];

    const results = searchPages(taggedMemos, "tag:project tag:important");

    expect(results.map((result) => result.path)).toEqual(["/work"]);
  });

  test("combines metadata tag filters with normal text search", () => {
    const taggedMemos = [
      createMemo("/work/roadmap", "# Roadmap\nRelease checklist", { tags: ["project"] }),
      createMemo("/personal/roadmap", "# Roadmap\nTrip ideas", { tags: ["journal"] }),
      createMemo("/work/notes", "# Notes\nMeeting notes", { tags: ["project"] }),
    ];

    const results = searchPages(taggedMemos, "tag:project roadmap");

    expect(results.map((result) => result.path)).toEqual(["/work/roadmap"]);
  });

  test("matches metadata tag queries case-insensitively", () => {
    const taggedMemos = [createMemo("/work", "# Work", { tags: ["Project"] })];

    const results = searchPages(taggedMemos, "tag:PROJECT");

    expect(results.map((result) => result.path)).toEqual(["/work"]);
  });

  test("supports quoted metadata tags with spaces", () => {
    const taggedMemos = [
      createMemo("/design", "# Design", { tags: ["product design"] }),
      createMemo("/dev", "# Dev", { tags: ["product"] }),
    ];

    const results = searchPages(taggedMemos, 'tag:"product design"');

    expect(results.map((result) => result.path)).toEqual(["/design"]);
  });
});
