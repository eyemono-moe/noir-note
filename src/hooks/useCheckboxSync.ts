import type { EditorView } from "@codemirror/view";
import type { Accessor } from "solid-js";

/**
 * Returns a handler for checkbox toggle events from the preview pane.
 *
 * Dispatches a single-character targeted change to the CodeMirror editor
 * instead of replacing the full document. This preserves the cursor position
 * and avoids the scroll-to-top that a full-document replace would cause.
 */
export function useCheckboxSync(
  editorView: Accessor<EditorView | undefined>,
): (offset: number, checked: boolean) => void {
  return (offset: number, checked: boolean) => {
    const view = editorView();
    if (!view) return;

    const content = view.state.doc.toString();
    // Search for the opening bracket within a short window after the list
    // item's start. This handles `- [ ]`, `* [ ]`, `1. [ ]`, indented lists, etc.
    const searchEnd = Math.min(offset + 10, content.length);
    const bracketPos = content.indexOf("[", offset);
    if (bracketPos === -1 || bracketPos >= searchEnd) return;

    view.dispatch({
      changes: { from: bracketPos + 1, to: bracketPos + 2, insert: checked ? " " : "x" },
    });
  };
}
