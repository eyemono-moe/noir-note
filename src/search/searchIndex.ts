import { Document } from "flexsearch";

import type { PageSearchResult } from "../commands/types";
import type { Memo } from "../types/memo";

interface ParsedSearchQuery {
  text: string;
  tags: string[];
}

type MatchKind = "path" | "title" | "content" | "tag-only";

type SearchDocument = {
  id: string;
  path: string;
  title: string;
  content: string;
};

const matchKindScore: Record<MatchKind, number> = {
  path: 0,
  title: 1,
  content: 2,
  "tag-only": 3,
};

const tagTokenPattern = /(?:^|\s)tag:(?:"([^"]+)"|'([^']+)'|(\S+))/gi;
const cjkCharPattern = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const tokenPattern = /[\p{L}\p{N}_-]+/gu;

export function extractTitle(path: string, content: string): string {
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      return trimmed.slice(2).trim();
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      return trimmed.length > 50 ? `${trimmed.slice(0, 50)}...` : trimmed;
    }
  }

  return path;
}

export function extractPreview(content: string, maxLines = 2, maxChars = 100): string {
  const lines = content.split("\n");
  const previewLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("# ")) {
      continue;
    }

    if (trimmed === "---") {
      continue;
    }

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

export function tokenizeForSearch(text: string): string[] {
  const tokens: string[] = [];
  for (const match of text.matchAll(tokenPattern)) {
    const token = match[0].toLowerCase();
    if (!cjkCharPattern.test(token)) {
      tokens.push(token);
      continue;
    }

    const chars = Array.from(token);
    if (chars.length === 1) {
      tokens.push(chars[0]);
      continue;
    }

    for (let index = 0; index < chars.length - 1; index += 1) {
      tokens.push(`${chars[index]}${chars[index + 1]}`);
    }
  }
  return tokens;
}

function augmentForIndex(text: string): string {
  return tokenizeForSearch(text).join(" ");
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

function hasCjkSearchMatch(memo: Memo, title: string, query: string): boolean {
  const queryTokens = tokenizeForSearch(query).filter((token) => cjkCharPattern.test(token));
  if (queryTokens.length === 0) {
    return false;
  }

  const haystack = augmentForIndex(`${memo.path} ${title} ${memo.content}`);
  return queryTokens.every((token) => haystack.includes(token));
}

function toSearchDocument(memo: Memo, title: string): SearchDocument {
  return {
    id: memo.path,
    path: augmentForIndex(memo.path),
    title: augmentForIndex(title),
    content: augmentForIndex(memo.content),
  };
}

function uniqueIdsFromFlexSearch(results: Array<{ field: string; result: string[] }>): string[] {
  return [...new Set(results.flatMap((fieldResult) => fieldResult.result))];
}

export class SearchIndex {
  private readonly docs = new Map<string, Memo>();
  private index = this.createFlexIndex();

  constructor(memos: Memo[] = []) {
    this.rebuild(memos);
  }

  rebuild(memos: Memo[]): void {
    this.docs.clear();
    this.index = this.createFlexIndex();
    for (const memo of memos) {
      this.update(memo);
    }
  }

  update(memo: Memo): void {
    this.docs.set(memo.path, memo);
    const title = extractTitle(memo.path, memo.content);
    const document = toSearchDocument(memo, title);
    if (this.index.contain(memo.path)) {
      this.index.update(memo.path, document);
    } else {
      this.index.add(memo.path, document);
    }
  }

  remove(path: string): void {
    this.docs.delete(path);
    if (this.index.contain(path)) {
      this.index.remove(path);
    }
  }

  search(query: string): PageSearchResult[] {
    const parsedQuery = parseSearchQuery(query);
    const textQuery = parsedQuery.text;

    if (!textQuery && parsedQuery.tags.length === 0) {
      return [];
    }

    const candidates = this.getCandidateMemos(textQuery);
    const results: Array<PageSearchResult & { matchKind: MatchKind }> = [];

    for (const memo of candidates) {
      const title = extractTitle(memo.path, memo.content);

      if (!matchesAllTags(memo.metadata?.tags, parsedQuery.tags)) {
        continue;
      }

      const matchKind =
        getMatchKind(memo, title, textQuery) ??
        (textQuery && hasCjkSearchMatch(memo, title, textQuery) ? "content" : undefined);
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

  private getCandidateMemos(textQuery: string): Memo[] {
    if (!textQuery) {
      return [...this.docs.values()];
    }

    const tokenizedQuery = augmentForIndex(textQuery);
    if (!tokenizedQuery) {
      return [];
    }

    const searchResults = this.index.search(tokenizedQuery, { enrich: false });
    const ids = uniqueIdsFromFlexSearch(
      searchResults as Array<{ field: string; result: string[] }>,
    );
    return ids.flatMap((id) => {
      const memo = this.docs.get(id);
      return memo ? [memo] : [];
    });
  }

  private createFlexIndex(): Document<SearchDocument> {
    return new Document<SearchDocument>({
      document: {
        id: "id",
        index: ["path", "title", "content"],
      },
      tokenize: "forward",
    });
  }
}

export function createSearchIndex(memos: Memo[] = []): SearchIndex {
  return new SearchIndex(memos);
}
