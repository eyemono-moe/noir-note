import { describe, expect, test } from "vite-plus/test";

import { buildSidebarSearchGroups, highlightSearchSnippet } from "./searchPanel";

describe("buildSidebarSearchGroups", () => {
  test("groups worker search results by memo and keeps all matching snippets", () => {
    const groups = buildSidebarSearchGroups(
      [
        {
          path: "daily/2026-05-14",
          title: "Daily Note",
          preview: "met with Noir about search",
          matches: [
            { preview: "met with Noir about search", lineNumber: 3 },
            { preview: "follow-up search notes", lineNumber: 8 },
          ],
        },
        { path: "projects/search", title: "Search Plan", preview: "sidebar search panel" },
      ],
      "search",
    );

    expect(groups).toEqual([
      {
        path: "daily/2026-05-14",
        title: "Daily Note",
        matches: [
          {
            lineNumber: 3,
            preview: [
              { text: "met with Noir about ", matched: false },
              { text: "search", matched: true },
            ],
          },
          {
            lineNumber: 8,
            preview: [
              { text: "follow-up ", matched: false },
              { text: "search", matched: true },
              { text: " notes", matched: false },
            ],
          },
        ],
      },
      {
        path: "projects/search",
        title: "Search Plan",
        matches: [
          {
            lineNumber: undefined,
            preview: [
              { text: "sidebar ", matched: false },
              { text: "search", matched: true },
              { text: " panel", matched: false },
            ],
          },
        ],
      },
    ]);
  });

  test("uses tag-filter results without marking tag tokens as text matches", () => {
    const groups = buildSidebarSearchGroups(
      [{ path: "recipes/curry", title: "Curry", preview: "spice notes" }],
      "tag:food",
    );

    expect(groups[0]?.matches[0]?.preview).toEqual([{ text: "spice notes", matched: false }]);
  });
});

describe("highlightSearchSnippet", () => {
  test("highlights matches case-insensitively", () => {
    expect(highlightSearchSnippet("Search sidebar search", "search")).toEqual([
      { text: "Search", matched: true },
      { text: " sidebar ", matched: false },
      { text: "search", matched: true },
    ]);
  });
});
