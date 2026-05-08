import type { Memo } from "../types/memo";
import type { PageSearchResult } from "./types";

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

export function matchesAllTags(tags: string[] | undefined, requiredTags: string[]): boolean {
  if (requiredTags.length === 0) {
    return true;
  }
  if (!tags || tags.length === 0) {
    return false;
  }

  const normalizedTags = new Set(tags.map((tag) => tag.toLowerCase()));
  return requiredTags.every((requiredTag) => normalizedTags.has(requiredTag.toLowerCase()));
}

/**
 * Search pages by query string
 * Searches in path, title, content, and metadata tags via tag:<tag> filters.
 */
export function searchPages(memos: Memo[], query: string): PageSearchResult[] {
  const parsedQuery = parseSearchQuery(query);
  const lowerTextQuery = parsedQuery.text.toLowerCase();

  if (!lowerTextQuery && parsedQuery.tags.length === 0) {
    return [];
  }

  const results: PageSearchResult[] = [];

  for (const memo of memos) {
    const title = extractTitle(memo.path, memo.content);
    const preview = extractPreview(memo.content);

    if (!matchesAllTags(memo.metadata?.tags, parsedQuery.tags)) {
      continue;
    }

    // Check if query matches path, title, or content
    const matchesPath = !lowerTextQuery || memo.path.toLowerCase().includes(lowerTextQuery);
    const matchesTitle = !lowerTextQuery || title.toLowerCase().includes(lowerTextQuery);
    const matchesContent = !lowerTextQuery || memo.content.toLowerCase().includes(lowerTextQuery);

    if (matchesPath || matchesTitle || matchesContent) {
      results.push({
        path: memo.path,
        title,
        preview,
      });
    }
  }

  // Sort by relevance (path match > title match > content match)
  return results.sort((a, b) => {
    const aPathMatch = lowerTextQuery ? a.path.toLowerCase().includes(lowerTextQuery) : false;
    const bPathMatch = lowerTextQuery ? b.path.toLowerCase().includes(lowerTextQuery) : false;
    const aTitleMatch = lowerTextQuery ? a.title.toLowerCase().includes(lowerTextQuery) : false;
    const bTitleMatch = lowerTextQuery ? b.title.toLowerCase().includes(lowerTextQuery) : false;

    if (aPathMatch && !bPathMatch) return -1;
    if (!aPathMatch && bPathMatch) return 1;
    if (aTitleMatch && !bTitleMatch) return -1;
    if (!aTitleMatch && bTitleMatch) return 1;

    return a.path.localeCompare(b.path);
  });
}
