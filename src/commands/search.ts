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

/**
 * Search pages by query string
 * Searches in path, title, and content
 */
export function searchPages(memos: Memo[], query: string): PageSearchResult[] {
  if (!query.trim()) {
    return [];
  }

  const lowerQuery = query.toLowerCase();
  const results: PageSearchResult[] = [];

  for (const memo of memos) {
    const title = extractTitle(memo.path, memo.content);
    const preview = extractPreview(memo.content);

    // Check if query matches path, title, or content
    const matchesPath = memo.path.toLowerCase().includes(lowerQuery);
    const matchesTitle = title.toLowerCase().includes(lowerQuery);
    const matchesContent = memo.content.toLowerCase().includes(lowerQuery);

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
    const aPathMatch = a.path.toLowerCase().includes(lowerQuery);
    const bPathMatch = b.path.toLowerCase().includes(lowerQuery);
    const aTitleMatch = a.title.toLowerCase().includes(lowerQuery);
    const bTitleMatch = b.title.toLowerCase().includes(lowerQuery);

    if (aPathMatch && !bPathMatch) return -1;
    if (!aPathMatch && bPathMatch) return 1;
    if (aTitleMatch && !bTitleMatch) return -1;
    if (!aTitleMatch && bTitleMatch) return 1;

    return a.path.localeCompare(b.path);
  });
}
