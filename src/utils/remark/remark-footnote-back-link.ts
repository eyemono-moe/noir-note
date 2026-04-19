import type { Root } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

// This plugin adds a back-link to footnote definitions, allowing users to navigate back to the reference point in the text where the footnote was referenced.
// The back-link is added as a new node type "footnote-back-link" at the end of the footnote definition's content.
export const remarkFootnoteBackLink: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, "footnoteDefinition", (node) => {
      visit(node, "paragraph", (childParagraph) => {
        childParagraph.children.push({
          type: "footnote-back-link",
          url: `#fnref-${node.identifier}`,
        });
      });
    });
  };
};

declare module "mdast" {
  export interface FootnoteBackLink extends Resource {
    type: "footnote-back-link";
  }

  // oxlint-disable-next-line no-unused-vars - This is necessary to augment the existing mdast types with our custom node type
  interface RootContentMap {
    "footnote-back-link": FootnoteBackLink;
  }

  // oxlint-disable-next-line no-unused-vars - This is necessary to augment the existing mdast types with our custom node type
  interface PhrasingContentMap {
    "footnote-back-link": FootnoteBackLink;
  }
}
