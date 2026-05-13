import type { PageSearchResult } from "../commands/types";
import type { Memo } from "../types/memo";
import type { SearchWorkerRequest, SearchWorkerResponse } from "./searchIndex.worker";
// oxlint-disable-next-line import/default --- needed for Vite worker import
import SearchWorker from "./searchIndex.worker?worker";

type SearchWorkerRequestPayload =
  | { type: "rebuild"; memos: Memo[] }
  | { type: "update"; memo: Memo }
  | { type: "remove"; path: string }
  | { type: "search"; query: string; limit?: number };

type SearchWorkerLike = Pick<Worker, "postMessage" | "onmessage">;

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

type SearchOptions = {
  limit?: number;
};

class SearchWorkerClient {
  private readonly pending = new Map<number, PendingRequest>();
  private readonly worker: SearchWorkerLike;
  private nextId = 0;

  constructor(worker: SearchWorkerLike) {
    this.worker = worker;
    this.worker.onmessage = (event: MessageEvent<SearchWorkerResponse>) => {
      const { id, ok } = event.data;
      const pending = this.pending.get(id);
      if (!pending) return;

      this.pending.delete(id);
      if (ok) {
        pending.resolve(event.data.data);
      } else {
        pending.reject(new Error(event.data.error));
      }
    };
  }

  rebuild(memos: Memo[]): Promise<void> {
    return this.request<void>({ type: "rebuild", memos });
  }

  update(memo: Memo): Promise<void> {
    return this.request<void>({ type: "update", memo });
  }

  remove(path: string): Promise<void> {
    return this.request<void>({ type: "remove", path });
  }

  search(query: string, options: SearchOptions = {}): Promise<PageSearchResult[]> {
    return this.request<PageSearchResult[]>({ type: "search", query, limit: options.limit });
  }

  private request<T>(payload: SearchWorkerRequestPayload): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
      this.worker.postMessage({ ...payload, id } as SearchWorkerRequest);
    });
  }
}

export function createSearchWorkerClient(worker: SearchWorkerLike): SearchWorkerClient {
  return new SearchWorkerClient(worker);
}

let defaultSearchClient: SearchWorkerClient | undefined;

export function getSearchClient(): SearchWorkerClient {
  defaultSearchClient ??= createSearchWorkerClient(new SearchWorker());
  return defaultSearchClient;
}
