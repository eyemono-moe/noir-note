import { extractPreview, extractTitle, SearchIndex } from "../search/searchIndex";
import type { Memo } from "../types/memo";
import type { PageSearchResult, PaletteItem } from "./types";

export { extractPreview, extractTitle, parseSearchQuery } from "../search/searchIndex";

export function searchPages(memos: Memo[], query: string) {
  return new SearchIndex(memos).search(query);
}

export function buildPagePaletteItems(
  memos: Memo[],
  query: string,
  maxItems = Number.POSITIVE_INFINITY,
  searchResults?: PageSearchResult[],
): PaletteItem[] {
  const trimmedQuery = query.trim();
  const pageResults = trimmedQuery
    ? (searchResults ?? searchPages(memos, trimmedQuery))
    : [...memos]
        .sort((a, b) => a.path.localeCompare(b.path))
        .map((memo) => ({
          path: memo.path,
          title: extractTitle(memo.path, memo.content),
          preview: extractPreview(memo.content),
        }));

  return pageResults.slice(0, maxItems).map((result) => {
    const memo = memos.find((candidate) => candidate.path === result.path);
    return {
      type: "page",
      value: result.path,
      label: memo?.metadata?.title || result.title,
      description: result.preview || result.path,
      preview: result.preview,
      tags: memo?.metadata?.tags,
    };
  });
}
