import { history, historyKeymap } from "@codemirror/commands";
import { defaultKeymap } from "@codemirror/commands";
import { bracketMatching } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { lineNumbers, highlightActiveLineGutter, highlightActiveLine } from "@codemirror/view";
import { keymap } from "@codemirror/view";

import { markdown } from "./markdown";
import { monochromeTheme } from "./theme";

export function createEditorExtensions() {
  return [
    // Basic editing
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    history(),
    bracketMatching(),

    // Keymaps
    keymap.of([...defaultKeymap, ...historyKeymap]),

    // Language support
    ...markdown(),

    // Theme
    monochromeTheme,
    EditorView.lineWrapping,
  ];
}
