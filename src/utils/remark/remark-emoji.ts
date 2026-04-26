import { nameToEmoji } from "gemoji";
import type { Root, Text } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

// Same pattern as remark-gemoji: handles +1 and any word/hyphen shortcodes
const EMOJI_REGEX = /:(\+1|[-\w]+):/g;

/**
 * Remark plugin that replaces emoji shortcodes (e.g. `:smile:`) with the
 * corresponding Unicode emoji character (e.g. `😊`).
 * Unknown shortcodes are left unchanged.
 */
export const remarkEmoji: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, "text", (node: Text) => {
      node.value = node.value.replace(EMOJI_REGEX, (match, name: string) => {
        return Object.hasOwn(nameToEmoji, name) ? nameToEmoji[name] : match;
      });
    });
  };
};
