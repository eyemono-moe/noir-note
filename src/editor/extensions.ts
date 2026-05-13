import { autocompletion } from "@codemirror/autocomplete";
import type { CompletionContext } from "@codemirror/autocomplete";
import { history, historyKeymap, indentWithTab, redo, redoSelection } from "@codemirror/commands";
import { defaultKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { bracketMatching, indentUnit } from "@codemirror/language";
import { search, searchKeymap } from "@codemirror/search";
import { EditorState } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import { EditorView, highlightWhitespace } from "@codemirror/view";
import { lineNumbers, highlightActiveLineGutter, highlightActiveLine } from "@codemirror/view";
import { keymap } from "@codemirror/view";

import { dateCompletionSource } from "./dateCompletion";
import { emojiCompletionSource } from "./emojiCompletion";
import { formatKeyBindings } from "./formatter";
import { imagePasteExtension } from "./imagePaste";
import { multiCursorExtension } from "./multiCursor";
import { noteLinkCompletionSource } from "./noteLinkCompletion";
import type { NoteLinkCompletionContext } from "./noteLinkCompletion";
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

export function createEditorExtensions(
  isDark: boolean,
  noteLinkContext?: NoteLinkCompletionContext,
): Extension[] {
  const completionSources = noteLinkContext
    ? [
        emojiCompletionSource,
        dateCompletionSource,
        (context: CompletionContext) => noteLinkCompletionSource({ context, ...noteLinkContext }),
      ]
    : [emojiCompletionSource, dateCompletionSource];

  return [
    // Basic editing
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    history(),
    bracketMatching(),
    search({ top: true }),

    keymap.of(defaultKeymap),
    keymap.of([
      { key: "Mod-Shift-z", run: redo, preventDefault: true },
      { key: "Mod-Shift-u", run: redoSelection, preventDefault: true },
    ]), // The official historyKeymap uses Meta+Y for redo on Windows; override to Mod-Shift-Z. see: https://code.haverbeke.berlin/codemirror/commands/src/commit/30a280ea8aa5822a8e0eb9fd560e0cd28d3c836b/src/history.ts#L395
    keymap.of(historyKeymap),
    keymap.of(searchKeymap),
    keymap.of([indentWithTab]),
    indentUnit.of("  "), // 2 spaces; @codemirror/lang-markdown requires 2–5 for correct nested list behavior
    EditorView.lineWrapping,
    EditorState.tabSize.of(2),
    keymap.of(formatKeyBindings),
    wrapSelectionExtension,
    imagePasteExtension,
    multiCursorExtension,

    // Language support
    markdown(),
    // Combine inline completion sources into one autocompletion extension so
    // multiple `override` registrations don't compete.
    autocompletion({ override: completionSources }),

    [highlightWhitespace(), highlightWhitespaceTheme],

    // Theme
    ...(isDark ? darkTheme : lightTheme),
  ];
}
