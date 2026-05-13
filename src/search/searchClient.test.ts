import { describe, expect, test } from "vite-plus/test";

import type { Memo } from "../types/memo";
import { createSearchWorkerClient } from "./searchClient";
import type { SearchWorkerRequest, SearchWorkerResponse } from "./searchIndex.worker";

class FakeWorker {
  onmessage: ((event: MessageEvent<SearchWorkerResponse>) => void) | null = null;
  readonly requests: SearchWorkerRequest[] = [];

  postMessage(request: SearchWorkerRequest): void {
    this.requests.push(request);
    queueMicrotask(() => {
      this.onmessage?.({
        data: {
          id: request.id,
          ok: true,
          data:
            request.type === "search" ? [{ path: "/hit", title: "Hit", preview: "Preview" }] : null,
        },
      } as MessageEvent<SearchWorkerResponse>);
    });
  }
}

function createMemo(path: string, content: string): Memo {
  return {
    path,
    content,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe("createSearchWorkerClient", () => {
  test("bridges rebuild and search requests to the worker", async () => {
    const worker = new FakeWorker();
    const client = createSearchWorkerClient(worker);

    await client.rebuild([createMemo("/a", "# A")]);
    const results = await client.search("hit", { limit: 10 });

    expect(worker.requests.map((request) => request.type)).toEqual(["rebuild", "search"]);
    expect(worker.requests[1]).toMatchObject({ type: "search", query: "hit", limit: 10 });
    expect(results).toEqual([{ path: "/hit", title: "Hit", preview: "Preview" }]);
  });

  test("rejects worker error responses", async () => {
    const worker = new FakeWorker();
    worker.postMessage = (request) => {
      worker.requests.push(request);
      queueMicrotask(() => {
        worker.onmessage?.({
          data: { id: request.id, ok: false, error: "boom" },
        } as MessageEvent<SearchWorkerResponse>);
      });
    };
    const client = createSearchWorkerClient(worker);

    await expect(client.search("broken")).rejects.toThrow("boom");
  });
});
