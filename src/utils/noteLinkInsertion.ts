import type { MemoWithoutContent } from "../types/memo";
import { getParentPath, normalizePath } from "./path";

const MAX_CANDIDATES = 50;

type NoteLinkFormatOptions = {
  currentPath: string;
  targetPath: string;
  targetTitle?: string;
  selectedText?: string;
};

function pathSegments(path: string): string[] {
  const normalized = normalizePath(path);
  if (normalized === "/") return [];
  return normalized.slice(1).split("/");
}

function encodePathSegments(segments: string[]): string {
  return segments.map((segment) => encodeURIComponent(segment)).join("/");
}

function memoDisplayName(memo: Pick<MemoWithoutContent, "path" | "metadata">): string {
  const title = memo.metadata?.title?.trim();
  if (title) return title;

  const segments = pathSegments(memo.path);
  return segments.at(-1) ?? "/";
}

function escapeMarkdownLinkLabel(label: string): string {
  return label.replaceAll("\\", "\\\\").replaceAll("[", "\\[").replaceAll("]", "\\]");
}

function searchableText(memo: MemoWithoutContent): string {
  return [memo.path, memo.metadata?.title, ...(memo.metadata?.tags ?? [])]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join("\n")
    .toLowerCase();
}

/** Build a relative Markdown href from the current memo to another memo. */
export function makeRelativeNoteHref(currentPath: string, targetPath: string): string {
  const sourceDir = getParentPath(currentPath) ?? "/";
  const sourceSegments = pathSegments(sourceDir);
  const targetSegments = pathSegments(targetPath);

  let common = 0;
  while (
    common < sourceSegments.length &&
    common < targetSegments.length &&
    sourceSegments[common] === targetSegments[common]
  ) {
    common += 1;
  }

  const upSegments = Array.from({ length: sourceSegments.length - common }, () => "..");
  const downSegments = targetSegments.slice(common);
  const relativeSegments = [...upSegments, ...downSegments];

  if (relativeSegments.length === 0) return "./";
  if (downSegments.length === 0) return `${upSegments.join("/")}/`;
  return encodePathSegments(relativeSegments);
}

/** Format a canonical Markdown link to a note. */
export function formatMarkdownNoteLink(options: NoteLinkFormatOptions): string {
  const selected = options.selectedText?.trim();
  const label =
    selected || options.targetTitle?.trim() || memoDisplayName({ path: options.targetPath });
  const href = makeRelativeNoteHref(options.currentPath, options.targetPath);
  return `[${escapeMarkdownLinkLabel(label)}](${href})`;
}

/** Search existing memos for note-link insertion candidates. */
export function buildNoteLinkCandidates(options: {
  memos: readonly MemoWithoutContent[];
  currentPath: string;
  query: string;
  limit?: number;
}): MemoWithoutContent[] {
  const normalizedCurrentPath = normalizePath(options.currentPath);
  const query = options.query.trim().toLowerCase();
  const limit = options.limit ?? MAX_CANDIDATES;

  return options.memos
    .filter((memo) => normalizePath(memo.path) !== normalizedCurrentPath)
    .filter((memo) => !query || searchableText(memo).includes(query))
    .sort((a, b) => {
      if (!query) return b.updatedAt - a.updatedAt;

      const aTitle = a.metadata?.title?.toLowerCase() ?? "";
      const bTitle = b.metadata?.title?.toLowerCase() ?? "";
      const aPath = a.path.toLowerCase();
      const bPath = b.path.toLowerCase();
      const aScore = (aTitle.startsWith(query) ? 3 : 0) + (aPath.startsWith(`/${query}`) ? 2 : 0);
      const bScore = (bTitle.startsWith(query) ? 3 : 0) + (bPath.startsWith(`/${query}`) ? 2 : 0);
      if (aScore !== bScore) return bScore - aScore;
      return b.updatedAt - a.updatedAt;
    })
    .slice(0, limit);
}

export function getNoteLinkDisplayName(
  memo: Pick<MemoWithoutContent, "path" | "metadata">,
): string {
  return memoDisplayName(memo);
}
