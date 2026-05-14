import { describe, expect, test } from "vite-plus/test";

import type { Memo } from "../types/memo";
import { planSearchIndexUpdates, toSearchDocuments } from "./searchDocuments";

function createMemo(
  path: string,
  content: string,
  updatedAt = 1,
  metadata?: Memo["metadata"],
): Memo {
  return {
    path,
    content,
    createdAt: 1,
    updatedAt,
    metadata,
  };
}

describe("toSearchDocuments", () => {
  test("returns clone-safe memo documents without preserving reactive object references", () => {
    const source = createMemo("/a", "# A", 2, {
      title: "Custom A",
      tags: ["work"],
      ignoredNestedValue: { cannotCloneReactiveState: true },
    });

    const [document] = toSearchDocuments([source]);

    expect(document).toEqual({
      path: "/a",
      content: "# A",
      createdAt: 1,
      updatedAt: 2,
      metadata: {
        title: "Custom A",
        tags: ["work"],
      },
    });
    expect(document).not.toBe(source);
    expect(document.metadata).not.toBe(source.metadata);
    expect(document.metadata?.tags).not.toBe(source.metadata?.tags);
  });
});

describe("planSearchIndexUpdates", () => {
  test("plans a rebuild for the first synchronized snapshot", () => {
    const documents = [createMemo("/a", "# A")];

    const plan = planSearchIndexUpdates(new Map(), documents, false);

    expect(plan).toEqual({ type: "rebuild", documents });
  });

  test("plans incremental updates and removals after the initial rebuild", () => {
    const previous = new Map([
      ["/a", 1],
      ["/deleted", 1],
    ]);
    const changed = createMemo("/a", "# A updated", 2);
    const added = createMemo("/new", "# New", 1);

    const plan = planSearchIndexUpdates(previous, [changed, added], true);

    expect(plan).toEqual({
      type: "incremental",
      updates: [changed, added],
      removals: ["/deleted"],
    });
  });

  test("does not update unchanged documents", () => {
    const previous = new Map([["/a", 1]]);
    const unchanged = createMemo("/a", "# A", 1);

    const plan = planSearchIndexUpdates(previous, [unchanged], true);

    expect(plan).toEqual({ type: "incremental", updates: [], removals: [] });
  });
});
