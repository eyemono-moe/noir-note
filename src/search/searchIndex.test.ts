import { describe, expect, test } from "vite-plus/test";

import type { Memo } from "../types/memo";
import { createSearchIndex, tokenizeForSearch } from "./searchIndex";

function createMemo(path: string, content: string, metadata?: Memo["metadata"]): Memo {
  return {
    path,
    content,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    metadata,
  };
}

describe("tokenizeForSearch", () => {
  test("keeps ascii words and adds CJK bigrams", () => {
    expect(tokenizeForSearch("Project 日本語検索")).toEqual([
      "project",
      "日本",
      "本語",
      "語検",
      "検索",
    ]);
  });
});

describe("SearchIndex", () => {
  test("preserves path title content ranking and snippets", () => {
    const index = createSearchIndex();
    index.rebuild([
      createMemo("/content-only", "# Background\nalpha appears in the body"),
      createMemo("/alpha-path", "# Background\nNo body hit"),
      createMemo("/title-only", "# Alpha Heading\nNo body hit"),
    ]);

    const results = index.search("alpha");

    expect(results.map((result) => result.path)).toEqual([
      "/alpha-path",
      "/title-only",
      "/content-only",
    ]);
    expect(results[2].preview).toBe("alpha appears in the body");
  });

  test("supports tag filters and incremental updates", () => {
    const index = createSearchIndex([
      createMemo("/work", "# Work\nInitial notes", { tags: ["project"] }),
      createMemo("/personal", "# Personal\nInitial notes", { tags: ["journal"] }),
    ]);

    expect(index.search("tag:project").map((result) => result.path)).toEqual(["/work"]);

    index.update(
      createMemo("/work", "# Work\nUpdated roadmap", { tags: ["project", "important"] }),
    );
    index.remove("/personal");

    expect(index.search("tag:important roadmap").map((result) => result.path)).toEqual(["/work"]);
    expect(index.search("tag:journal")).toEqual([]);
  });

  test("matches Japanese two-character partial queries", () => {
    const index = createSearchIndex([
      createMemo("/jp", "# 日本語メモ\n全文検索を高速化する"),
      createMemo("/en", "# English\nfull text search"),
    ]);

    expect(index.search("検索").map((result) => result.path)).toEqual(["/jp"]);
  });

  test("returns empty while query is blank", () => {
    const index = createSearchIndex([createMemo("/home", "# Home")]);

    expect(index.search("   ")).toEqual([]);
  });
});
