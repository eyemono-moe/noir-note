import type { Memo } from "../types/memo";
import type { PageSearchResult, PaletteItem } from "./types";

/**
 * Extract title from memo content
 * Looks for first H1 heading, falls back to first non-empty line, then path
 */
export function extractTitle(path: string, content: string): string {
  const lines = content.split("\n");

  // Try to find H1 heading
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      return trimmed.slice(2).trim();
    }
  }

  // Fallback to first non-empty line
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      return trimmed.length > 50 ? `${trimmed.slice(0, 50)}...` : trimmed;
    }
  }

  // Fallback to path
  return path;
}

/**
 * Extract preview text from memo content
 * Returns first 2-3 non-empty lines, excluding title
 */
export function extractPreview(content: string, maxLines = 2, maxChars = 100): string {
  const lines = content.split("\n");
  const previewLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip H1 heading (title)
    if (trimmed.startsWith("# ")) {
      continue;
    }

    // Skip frontmatter
    if (trimmed === "---") {
      continue;
    }

    // Collect non-empty lines
    if (trimmed && previewLines.length < maxLines) {
      previewLines.push(trimmed);
    }

    if (previewLines.length >= maxLines) {
      break;
    }
  }

  const preview = previewLines.join(" ");
  return preview.length > maxChars ? `${preview.slice(0, maxChars)}...` : preview;
}

interface ParsedSearchQuery {
  text: string;
  tags: string[];
}

type MatchKind = "path" | "title" | "content" | "tag-only";

const matchKindScore: Record<MatchKind, number> = {
  path: 0,
  title: 1,
  content: 2,
  "tag-only": 3,
};

const tagTokenPattern = /(?:^|\s)tag:(?:"([^"]+)"|'([^']+)'|(\S+))/gi;

export function parseSearchQuery(query: string): ParsedSearchQuery {
  const tags: string[] = [];
  const text = query
    .replace(
      tagTokenPattern,
      (_match, doubleQuoted: string, singleQuoted: string, bare: string) => {
        const tag = doubleQuoted ?? singleQuoted ?? bare;
        if (tag.trim()) {
          tags.push(tag.trim());
        }
        return " ";
      },
    )
    .replace(/\s+/g, " ")
    .trim();

  return { text, tags };
}

function matchesAllTags(tags: string[] | undefined, requiredTags: string[]): boolean {
  if (requiredTags.length === 0) {
    return true;
  }
  if (!tags || tags.length === 0) {
    return false;
  }

  const normalizedTags = new Set(tags.map((tag) => tag.toLowerCase()));
  return requiredTags.every((requiredTag) => normalizedTags.has(requiredTag.toLowerCase()));
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function stripFrontmatter(content: string): string {
  return content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "");
}

function createSearchableContent(content: string): string {
  return stripFrontmatter(content)
    .split("\n")
    .filter((line) => !line.trim().startsWith("# "))
    .join("\n");
}

function createContentSnippet(content: string, query: string, maxChars = 80): string {
  const normalizedContent = collapseWhitespace(createSearchableContent(content));
  if (!normalizedContent || !query) {
    return extractPreview(content);
  }

  const matchIndex = normalizedContent.toLowerCase().indexOf(query.toLowerCase());
  if (matchIndex === -1) {
    return extractPreview(content);
  }

  const contextBefore = 19;
  const start = Math.max(0, matchIndex - contextBefore);
  const end = Math.min(normalizedContent.length, start + maxChars);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < normalizedContent.length ? "…" : "";
  return `${prefix}${normalizedContent.slice(start, end)}${suffix}`;
}

function getMatchKind(memo: Memo, title: string, query: string): MatchKind | undefined {
  if (!query) {
    return "tag-only";
  }

  const lowerTextQuery = query.toLowerCase();
  if (memo.path.toLowerCase().includes(lowerTextQuery)) return "path";
  if (title.toLowerCase().includes(lowerTextQuery)) return "title";
  if (memo.content.toLowerCase().includes(lowerTextQuery)) return "content";
  return undefined;
}

export function searchPages(memos: Memo[], query: string): PageSearchResult[] {
  const parsedQuery = parseSearchQuery(query);
  const textQuery = parsedQuery.text;

  if (!textQuery && parsedQuery.tags.length === 0) {
    return [];
  }

  const results: Array<PageSearchResult & { matchKind: MatchKind }> = [];

  for (const memo of memos) {
    const title = extractTitle(memo.path, memo.content);

    if (!matchesAllTags(memo.metadata?.tags, parsedQuery.tags)) {
      continue;
    }

    const matchKind = getMatchKind(memo, title, textQuery);
    if (!matchKind) {
      continue;
    }

    results.push({
      path: memo.path,
      title,
      preview:
        matchKind === "content"
          ? createContentSnippet(memo.content, textQuery)
          : extractPreview(memo.content),
      matchKind,
    });
  }

  return results
    .sort((a, b) => {
      const scoreDiff = matchKindScore[a.matchKind] - matchKindScore[b.matchKind];
      if (scoreDiff !== 0) return scoreDiff;
      return a.path.localeCompare(b.path);
    })
    .map(({ matchKind: _matchKind, ...result }) => result);
}

export function buildPagePaletteItems(
  memos: Memo[],
  query: string,
  maxItems = Number.POSITIVE_INFINITY,
): PaletteItem[] {
  const trimmedQuery = query.trim();
  const pageResults = trimmedQuery
    ? searchPages(memos, trimmedQuery)
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
