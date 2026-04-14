import { EditorView } from "@codemirror/view";
import { markdown } from "./markdown";
import { monochromeTheme } from "./theme";
import { lineNumbers, highlightActiveLineGutter, highlightActiveLine } from "@codemirror/view";
import { bracketMatching } from "@codemirror/language";
import { history, historyKeymap } from "@codemirror/commands";
import { keymap } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";

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
