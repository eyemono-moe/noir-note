import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

import { remarkEmbedLink } from "../../utils/remark/remark-embed-link";
import { remarkEmoji } from "../../utils/remark/remark-emoji";
import { remarkFootnoteBackLink } from "../../utils/remark/remark-footnote-back-link";

/**
 * Shared remark processor — created once at module load and reused across all
 * renders. All plugins are stateless transformers so this is safe.
 */
export const processor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkFootnoteBackLink)
  .use(remarkGfm)
  .use(remarkEmoji)
  // Must run after remarkGfm so that auto-linked bare URLs are already link nodes
  .use(remarkEmbedLink);
