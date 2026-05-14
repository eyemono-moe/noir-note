import { createSignal } from "solid-js";

import type { PageSearchResult } from "../commands/types";
import type { Memo } from "../types/memo";
import { getSearchClient } from "./searchClient";
import { planSearchIndexUpdates, toSearchDocuments, toUpdatedAtMap } from "./searchDocuments";

export interface SearchClient {
  rebuild(memos: Memo[]): Promise<void>;
  update(memo: Memo): Promise<void>;
  remove(path: string): Promise<void>;
  search(query: string, options?: SearchOptions): Promise<PageSearchResult[]>;
}

interface SearchOptions {
  limit?: number;
}

export interface SearchService {
  isReady: () => boolean;
  error: () => string | undefined;
  sync(memos: readonly Memo[]): Promise<void>;
  search(query: string, options?: SearchOptions): Promise<PageSearchResult[]>;
}

export function createSearchService(client: SearchClient = getSearchClient()): SearchService {
  const [isReady, setReady] = createSignal(false);
  const [error, setError] = createSignal<string | undefined>();
  let previousUpdatedAtByPath = new Map<string, number>();
  let hasBuiltIndex = false;

  return {
    isReady,
    error,
    async sync(memos) {
      const documents = toSearchDocuments(memos);
      const plan = planSearchIndexUpdates(previousUpdatedAtByPath, documents, hasBuiltIndex);

      setReady(false);
      setError(undefined);

      try {
        if (plan.type === "rebuild") {
          await client.rebuild(plan.documents);
        } else {
          for (const memo of plan.updates) {
            await client.update(memo);
          }
          for (const path of plan.removals) {
            await client.remove(path);
          }
        }

        previousUpdatedAtByPath = toUpdatedAtMap(documents);
        hasBuiltIndex = true;
        setReady(true);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught);
        setError(message);
        setReady(false);
        throw caught;
      }
    },
    search(query, options = {}) {
      return client.search(query, options);
    },
  };
}
