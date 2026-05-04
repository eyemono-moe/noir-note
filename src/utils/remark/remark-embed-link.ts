import type { Root } from "mdast";
import type { Plugin } from "unified";

/**
 * Remark plugin that detects standalone embed-eligible links at the root level.
 *
 * A paragraph qualifies when ALL of the following are true:
 *  1. It is a direct child of the root (top-level paragraph, not inside a list,
 *     blockquote, etc.)
 *  2. It has exactly one child node, which is a `link`
 *  3. The link has no title (`title === null`)
 *  4. The link's only child is a `text` node whose value equals the link URL
 *     (i.e. it is a bare auto-linked URL, not `[label](url)`)
 *
 * When a paragraph qualifies, `node.data.embedLinkUrl` is set to the URL.
 * The renderer reads this property to decide whether to show an embed widget
 * instead of a plain paragraph.
 */
export const remarkEmbedLink: Plugin<[], Root> = () => {
  return (tree: Root) => {
    for (const node of tree.children) {
      if (node.type !== "paragraph") continue;
      if (node.children.length !== 1) continue;

      const child = node.children[0];
      if (child.type !== "link") continue;
      if (child.title !== null) continue;

      // Must be a bare URL: the sole child of the link is a text node whose
      // value is identical to the URL (how remark-gfm represents auto-links).
      if (child.children.length !== 1) continue;
      const text = child.children[0];
      if (text.type !== "text") continue;
      if (text.value !== child.url) continue;

      node.data = { ...node.data, embedLinkUrl: child.url };
    }
  };
};

declare module "mdast" {
  interface ParagraphData {
    // oxlint-disable-next-line no-unused-vars
    embedLinkUrl?: string;
  }
}
