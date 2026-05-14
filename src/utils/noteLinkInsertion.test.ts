import { describe, expect, test } from "vite-plus/test";

import {
  buildNoteLinkCandidates,
  formatMarkdownNoteLink,
  makeRelativeNoteHref,
} from "./noteLinkInsertion";

const memos = [
  {
    path: "/notes/today",
    createdAt: 1,
    updatedAt: 3,
    metadata: { title: "Today", tags: ["daily", "journal"] },
  },
  {
    path: "/notes/project-alpha",
    createdAt: 1,
    updatedAt: 2,
    metadata: { title: "Project Alpha", tags: ["work"] },
  },
  {
    path: "/archive/old note",
    createdAt: 1,
    updatedAt: 1,
  },
];

describe("makeRelativeNoteHref", () => {
  test("returns a relative href from the current note directory", () => {
    expect(makeRelativeNoteHref("/notes/today", "/notes/project-alpha")).toBe("project-alpha");
    expect(makeRelativeNoteHref("/notes/today", "/archive/old note")).toBe("../archive/old%20note");
    expect(makeRelativeNoteHref("/today", "/notes/project-alpha")).toBe("notes/project-alpha");
  });

  test("returns ./ for a root target", () => {
    expect(makeRelativeNoteHref("/notes/today", "/")).toBe("../");
  });
});

describe("formatMarkdownNoteLink", () => {
  test("uses selected text as the label when provided", () => {
    expect(
      formatMarkdownNoteLink({
        currentPath: "/notes/today",
        targetPath: "/notes/project-alpha",
        targetTitle: "Project Alpha",
        selectedText: "this project",
      }),
    ).toBe("[this project](project-alpha)");
  });

  test("falls back to title then path basename for the label", () => {
    expect(
      formatMarkdownNoteLink({
        currentPath: "/notes/today",
        targetPath: "/notes/project-alpha",
        targetTitle: "Project Alpha",
      }),
    ).toBe("[Project Alpha](project-alpha)");

    expect(
      formatMarkdownNoteLink({
        currentPath: "/notes/today",
        targetPath: "/archive/old note",
      }),
    ).toBe("[old note](../archive/old%20note)");
  });

  test("escapes square brackets in labels", () => {
    expect(
      formatMarkdownNoteLink({
        currentPath: "/notes/today",
        targetPath: "/notes/project-alpha",
        selectedText: "[alpha]",
      }),
    ).toBe("[\\[alpha\\]](project-alpha)");
  });
});

describe("buildNoteLinkCandidates", () => {
  test("searches by title, path, and tags", () => {
    expect(buildNoteLinkCandidates({ memos, currentPath: "/notes/today", query: "alpha" })).toEqual(
      [memos[1]],
    );
    expect(
      buildNoteLinkCandidates({ memos, currentPath: "/notes/today", query: "archive" }),
    ).toEqual([memos[2]]);
    expect(buildNoteLinkCandidates({ memos, currentPath: "/notes/today", query: "work" })).toEqual([
      memos[1],
    ]);
  });

  test("excludes the current note and prefers recently updated notes for empty queries", () => {
    expect(buildNoteLinkCandidates({ memos, currentPath: "/notes/today", query: "" })).toEqual([
      memos[1],
      memos[2],
    ]);
  });
});
