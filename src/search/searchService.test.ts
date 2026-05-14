import { describe, expect, test } from "vite-plus/test";

import type { PageSearchResult } from "../commands/types";
import type { Memo } from "../types/memo";
import { createSearchService, type SearchClient } from "./searchService";

class FakeSearchClient implements SearchClient {
  readonly calls: Array<
    | { type: "rebuild"; memos: Memo[] }
    | { type: "update"; memo: Memo }
    | { type: "remove"; path: string }
    | { type: "search"; query: string; limit?: number }
  > = [];

  async rebuild(memos: Memo[]): Promise<void> {
    this.calls.push({ type: "rebuild", memos });
  }

  async update(memo: Memo): Promise<void> {
    this.calls.push({ type: "update", memo });
  }

  async remove(path: string): Promise<void> {
    this.calls.push({ type: "remove", path });
  }

  async search(query: string, options: { limit?: number } = {}): Promise<PageSearchResult[]> {
    this.calls.push({ type: "search", query, limit: options.limit });
    return [{ path: "/hit", title: "Hit", preview: "Preview" }];
  }
}

function createMemo(
  path: string,
  content: string,
  updatedAt = 1,
  metadata?: Memo["metadata"],
): Memo {
  return { path, content, createdAt: 1, updatedAt, metadata };
}

describe("createSearchService", () => {
  test("normalizes memos before rebuilding the worker index", async () => {
    const client = new FakeSearchClient();
    const service = createSearchService(client);
    const source = createMemo("/a", "# A", 1, {
      tags: ["work"],
      nested: { reactive: true },
    });

    await service.sync([source]);

    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]).toEqual({
      type: "rebuild",
      memos: [
        {
          path: "/a",
          content: "# A",
          createdAt: 1,
          updatedAt: 1,
          metadata: { tags: ["work"] },
        },
      ],
    });
  });

  test("uses worker incremental update and remove after initial rebuild", async () => {
    const client = new FakeSearchClient();
    const service = createSearchService(client);

    await service.sync([createMemo("/a", "# A"), createMemo("/deleted", "# Deleted")]);
    await service.sync([createMemo("/a", "# A updated", 2), createMemo("/new", "# New")]);

    expect(client.calls.map((call) => call.type)).toEqual([
      "rebuild",
      "update",
      "update",
      "remove",
    ]);
    expect(client.calls[1]).toMatchObject({ type: "update", memo: { path: "/a" } });
    expect(client.calls[2]).toMatchObject({ type: "update", memo: { path: "/new" } });
    expect(client.calls[3]).toEqual({ type: "remove", path: "/deleted" });
  });

  test("exposes readiness and delegates search to the worker client", async () => {
    const client = new FakeSearchClient();
    const service = createSearchService(client);

    expect(service.isReady()).toBe(false);
    await service.sync([createMemo("/a", "# A")]);
    expect(service.isReady()).toBe(true);

    const results = await service.search("hit", { limit: 5 });

    expect(client.calls.at(-1)).toEqual({ type: "search", query: "hit", limit: 5 });
    expect(results).toEqual([{ path: "/hit", title: "Hit", preview: "Preview" }]);
  });
});
