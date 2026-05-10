/**
 * Pure helpers for working with Markdown links between notes.
 *
 * resolveMemoLinkTarget: given a link href and the path of the source note,
 * return the normalized memo path the link points to, or null if the link
 * targets an external URL, an attachment, or otherwise does not refer to a
 * memo path.
 *
 * extractMemoLinks: walk a Markdown source string, collect every link
 * destination (inline links and reference link definitions), resolve each
 * via resolveMemoLinkTarget, exclude self-references, and return a
 * deduplicated list of memo paths referenced from the given source note.
 */

import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";

import { getParentPath, normalizePath } from "./path";

const EXTERNAL_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;
const ATTACHMENT_SCHEME = "attachment:";

function stripFragmentAndQuery(url: string): string {
  let result = url;
  const hashIdx = result.indexOf("#");
  if (hashIdx !== -1) result = result.slice(0, hashIdx);
  const queryIdx = result.indexOf("?");
  if (queryIdx !== -1) result = result.slice(0, queryIdx);
  return result;
}

/**
 * Resolve a Markdown link href against a source memo path.
 * Returns the normalized memo path or null when the href is not a memo link.
 */
export function resolveMemoLinkTarget(href: string, sourcePath: string): string | null {
  if (!href) return null;

  const trimmed = href.trim();
  if (!trimmed) return null;

  // Hash-only / empty fragment links
  if (trimmed.startsWith("#")) return null;

  // External / non-memo schemes (http:, https:, mailto:, attachment:, etc.)
  if (trimmed.toLowerCase().startsWith(ATTACHMENT_SCHEME)) return null;
  if (EXTERNAL_SCHEME_RE.test(trimmed)) return null;

  const cleaned = stripFragmentAndQuery(trimmed);
  if (!cleaned) return null;

  // Absolute memo path: starts with a single leading slash but is not a URL.
  if (cleaned.startsWith("/")) {
    return normalizePath(cleaned);
  }

  // Relative path: resolve against the source note's directory.
  const sourceDir = getParentPath(sourcePath) ?? "/";
  const baseSegments = sourceDir === "/" ? [] : sourceDir.slice(1).split("/");
  const relSegments = cleaned.split("/");

  for (const seg of relSegments) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (baseSegments.length > 0) baseSegments.pop();
      continue;
    }
    baseSegments.push(seg);
  }

  if (baseSegments.length === 0) return "/";
  return `/${baseSegments.join("/")}`;
}

interface LinkLikeNode {
  type: string;
  url?: string;
}

/**
 * Walk Markdown source and return the deduplicated, normalized memo paths
 * that the source references. Self-links are excluded.
 *
 * Detects:
 *   - Inline links:    [label](./path)
 *   - Reference defs:  [id]: ./path
 *
 * Excludes:
 *   - External URLs (http, https, mailto, ...)
 *   - attachment:// references
 *   - Hash-only / empty links
 *   - Self-links to sourcePath
 */
export function extractMemoLinks(content: string, sourcePath: string): string[] {
  const tree = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ["yaml"])
    .use(remarkGfm)
    .parse(content);

  const normalizedSource = normalizePath(sourcePath);
  const seen = new Set<string>();
  const result: string[] = [];

  // We treat link, linkReference (resolved via definitions), and definition
  // nodes as link sources. The simplest correct approach: collect URLs from
  // `link` and `definition` nodes — `linkReference` resolves to the matching
  // `definition` URL, so capturing definitions directly already covers them.
  visit(tree, (node) => {
    const n = node as LinkLikeNode;
    if (n.type !== "link" && n.type !== "definition") return;
    const url = n.url;
    if (typeof url !== "string") return;

    const target = resolveMemoLinkTarget(url, normalizedSource);
    if (!target) return;
    if (target === normalizedSource) return;
    if (seen.has(target)) return;
    seen.add(target);
    result.push(target);
  });

  return result;
}
