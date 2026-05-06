import { history, historyKeymap, indentWithTab, redo, redoSelection } from "@codemirror/commands";
import { defaultKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { bracketMatching, indentUnit } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import { EditorView, highlightWhitespace } from "@codemirror/view";
import { lineNumbers, highlightActiveLineGutter, highlightActiveLine } from "@codemirror/view";
import { keymap } from "@codemirror/view";

import { emojiCompletionExtension } from "./emojiCompletion";
import { formatKeyBindings } from "./formatter";
import { imagePasteExtension } from "./imagePaste";
import { darkTheme, lightTheme } from "./theme";
import { wrapSelectionExtension } from "./wrapSelection";

const highlightWhitespaceTheme = EditorView.theme({
  "[data-theme='light'] &": {
    "--cm-highlight-space-color": "#6a737d10",
  },
  "[data-theme='dark'] &": {
    "--cm-highlight-space-color": "#8b949e10",
  },
  ".cm-highlightSpace": {
    "background-image":
      "radial-gradient(circle at 50% 50%, var(--cm-highlight-space-color) 18%, transparent 28%);",
  },
});

export function createEditorExtensions(isDark: boolean): Extension[] {
  return [
    // Basic editing
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    history(),
    bracketMatching(),

    keymap.of(defaultKeymap),
    keymap.of([
      { key: "Mod-Shift-z", run: redo, preventDefault: true },
      { key: "Mod-Shift-u", run: redoSelection, preventDefault: true },
    ]), // The official historyKeymap uses Meta+Y for redo on Windows; override to Mod-Shift-Z. see: https://code.haverbeke.berlin/codemirror/commands/src/commit/30a280ea8aa5822a8e0eb9fd560e0cd28d3c836b/src/history.ts#L395
    keymap.of(historyKeymap),
    keymap.of([indentWithTab]),
    indentUnit.of("  "), // 2 spaces; @codemirror/lang-markdown requires 2–5 for correct nested list behavior
    EditorView.lineWrapping,
    EditorState.tabSize.of(2),
    keymap.of(formatKeyBindings),
    wrapSelectionExtension,
    imagePasteExtension,

    // Language support
    markdown(),
    emojiCompletionExtension,

    [highlightWhitespace(), highlightWhitespaceTheme],

    // Theme
    ...(isDark ? darkTheme : lightTheme),
  ];
}
