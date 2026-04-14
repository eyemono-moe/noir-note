import { markdown as markdownLang } from "@codemirror/lang-markdown";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";

export function markdown() {
  return [markdownLang(), syntaxHighlighting(defaultHighlightStyle)];
}
