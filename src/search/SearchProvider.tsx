import { useLiveQuery } from "@tanstack/solid-db";
import { createContext, createEffect, useContext, type ParentComponent } from "solid-js";

import { useMemosCollection } from "../context/db";
import { createSearchService, type SearchService } from "./searchService";

const SearchContext = createContext<SearchService>();

export const SearchProvider: ParentComponent = (props) => {
  const memosCollection = useMemosCollection();
  const searchService = createSearchService();
  const allMemosQuery = useLiveQuery((q) =>
    q.from({ memos: memosCollection }).select(({ memos }) => ({
      path: memos.path,
      content: memos.content,
      createdAt: memos.createdAt,
      updatedAt: memos.updatedAt,
      metadata: memos.metadata,
    })),
  );

  // Keep the shared Worker search index synchronized with OPFS/TanStack DB memo state.
  createEffect(() => {
    const allMemos = allMemosQuery();
    if (!allMemos) return;

    void searchService.sync(allMemos).catch((caught: unknown) => {
      console.error("[SearchProvider] Search index update failed:", caught);
    });
  });

  return <SearchContext.Provider value={searchService}>{props.children}</SearchContext.Provider>;
};

export function useSearch(): SearchService {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error("useSearch must be used within SearchProvider");
  }
  return context;
}
