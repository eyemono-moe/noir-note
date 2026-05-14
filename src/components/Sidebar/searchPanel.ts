import type { PageSearchResult } from "../../commands/types";
import { parseSearchQuery } from "../../search/searchIndex";

interface HighlightPart {
  text: string;
  matched: boolean;
}

interface SidebarSearchMatch {
  lineNumber?: number;
  preview: HighlightPart[];
}

interface SidebarSearchGroup {
  path: string;
  title: string;
  matches: SidebarSearchMatch[];
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function highlightSearchSnippet(snippet: string, query: string): HighlightPart[] {
  const textQuery = parseSearchQuery(query).text;
  if (!textQuery) return [{ text: snippet, matched: false }];

  const pattern = new RegExp(escapeRegExp(textQuery), "gi");
  const parts: HighlightPart[] = [];
  let lastIndex = 0;

  for (const match of snippet.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ text: snippet.slice(lastIndex, index), matched: false });
    }
    parts.push({ text: match[0], matched: true });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < snippet.length) {
    parts.push({ text: snippet.slice(lastIndex), matched: false });
  }

  return parts.length > 0 ? parts : [{ text: snippet, matched: false }];
}

export function buildSidebarSearchGroups(
  results: PageSearchResult[],
  query: string,
): SidebarSearchGroup[] {
  return results.map((result) => ({
    path: result.path,
    title: result.title,
    matches: (result.matches && result.matches.length > 0
      ? result.matches
      : [{ preview: result.preview || result.path }]
    ).map((match) => ({
      lineNumber: match.lineNumber,
      preview: highlightSearchSnippet(match.preview, query),
    })),
  }));
}
