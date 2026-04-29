import type { RootContent, RootContentMap } from "mdast";

import type { Definitions, LightboxItem } from "./contexts";

// ============================================================================
// Definition collection
// ============================================================================

/**
 * Walk the AST and collect all `definition` nodes into a lookup map.
 * Definitions can appear at any block level, so the walk is recursive.
 */
export function collectDefinitions(nodes: readonly RootContent[]): Definitions {
  const defs = new Map<string, { url: string; title?: string | null }>();
  function walk(node: RootContent) {
    if (node.type === "definition") {
      defs.set(node.identifier, { url: node.url, title: node.title });
    }
    if ("children" in node) {
      for (const child of (node as { children: RootContent[] }).children) walk(child);
    }
  }
  for (const node of nodes) walk(node);
  return defs;
}

// ============================================================================
// Lightbox item collection
// ============================================================================

/**
 * Collect all lightbox items (images and Mermaid diagrams) from an AST subtree
 * in document order. Used to build the prev/next navigation list for the lightbox.
 * `defs` is required to resolve `imageReference` nodes to their URLs.
 */
export function collectLightboxItems(
  nodes: readonly RootContent[],
  defs: Definitions,
): LightboxItem[] {
  const items: LightboxItem[] = [];
  function walk(node: RootContent) {
    if (node.type === "image") {
      items.push({ type: "image", url: node.url, offset: node.position?.start?.offset ?? -1 });
    } else if (node.type === "imageReference") {
      const def = defs.get(node.identifier);
      if (def) {
        items.push({ type: "image", url: def.url, offset: node.position?.start?.offset ?? -1 });
      }
    } else if (node.type === "code" && node.lang === "mermaid") {
      items.push({
        type: "mermaid",
        code: node.value,
        offset: node.position?.start?.offset ?? -1,
      });
    }
    if ("children" in node) {
      for (const child of (node as { children: RootContent[] }).children) walk(child);
    }
  }
  for (const node of nodes) walk(node);
  return items;
}

// ============================================================================
// Footnote extraction
// ============================================================================

/**
 * Collect all `footnoteDefinition` nodes from the AST in document order.
 * These are rendered separately at the bottom of the document.
 */
export function extractFootnotes(
  nodes: readonly RootContent[],
): RootContentMap["footnoteDefinition"][] {
  const footnotes: RootContentMap["footnoteDefinition"][] = [];
  const traverse = (ns: readonly RootContent[]) => {
    for (const node of ns) {
      if (node.type === "footnoteDefinition") {
        footnotes.push(node);
      }
      if ("children" in node) {
        traverse(node.children);
      }
    }
  };
  traverse(nodes);
  return footnotes;
}
