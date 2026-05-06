import { EditorSelection } from "@codemirror/state";
import type { KeyBinding } from "@codemirror/view";
import { keymap } from "@codemirror/view";

const BRACKET_PAIRS: Record<string, string> = {
  '"': '"',
  _: "_",
  "'": "'",
  "(": ")",
  "[": "]",
  "{": "}",
  "*": "*",
  "`": "`",
  "<": ">",
  "~": "~",
};

function wrapSelectionWith(open: string, close: string): KeyBinding {
  return {
    key: open,
    run(view) {
      const { state } = view;
      // Fall through to default behavior when all selections are cursor-only (empty ranges).
      if (state.selection.ranges.every((r) => r.empty)) return false;

      view.dispatch(
        state.changeByRange((range) => {
          if (range.empty) {
            // No change for this empty range; other ranges in a multi-cursor
            // selection may still be wrapped.
            return { range };
          }
          const selectedText = state.sliceDoc(range.from, range.to);
          const insert = open + selectedText + close;
          return {
            changes: { from: range.from, to: range.to, insert },
            // Keep the selection on the wrapped text (excluding the added brackets).
            range: EditorSelection.range(
              range.from + open.length,
              range.from + insert.length - close.length,
            ),
          };
        }),
      );
      return true;
    },
  };
}

export const wrapSelectionExtension = keymap.of(
  Object.entries(BRACKET_PAIRS).map(([open, close]) => wrapSelectionWith(open, close)),
);
