import type { PageSearchResult } from "../commands/types";
import type { Memo } from "../types/memo";
import { createSearchIndex } from "./searchIndex";

export type SearchWorkerRequest =
  | { id: number; type: "rebuild"; memos: Memo[] }
  | { id: number; type: "update"; memo: Memo }
  | { id: number; type: "remove"; path: string }
  | { id: number; type: "search"; query: string; limit?: number };

export type SearchWorkerResponse<T = unknown> =
  | { id: number; ok: true; data: T }
  | { id: number; ok: false; error: string };

const index = createSearchIndex();

self.onmessage = (event: MessageEvent<SearchWorkerRequest>) => {
  const { id } = event.data;

  try {
    switch (event.data.type) {
      case "rebuild": {
        index.rebuild(event.data.memos);
        self.postMessage({ id, ok: true, data: null } satisfies SearchWorkerResponse<null>);
        break;
      }
      case "update": {
        index.update(event.data.memo);
        self.postMessage({ id, ok: true, data: null } satisfies SearchWorkerResponse<null>);
        break;
      }
      case "remove": {
        index.remove(event.data.path);
        self.postMessage({ id, ok: true, data: null } satisfies SearchWorkerResponse<null>);
        break;
      }
      case "search": {
        const results = index.search(event.data.query).slice(0, event.data.limit);
        self.postMessage({ id, ok: true, data: results } satisfies SearchWorkerResponse<
          PageSearchResult[]
        >);
        break;
      }
    }
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error) } satisfies SearchWorkerResponse<never>);
  }
};
