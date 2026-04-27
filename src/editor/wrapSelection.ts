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
      // すべての選択範囲が空（カーソルのみ）の場合はデフォルト動作にフォールスルー
      if (state.selection.ranges.every((r) => r.empty)) return false;

      view.dispatch(
        state.changeByRange((range) => {
          if (range.empty) {
            // この選択範囲が空なら変更なし（他の範囲がある場合に備えて range はそのまま）
            return { range };
          }
          const selectedText = state.sliceDoc(range.from, range.to);
          const insert = open + selectedText + close;
          return {
            changes: { from: range.from, to: range.to, insert },
            // ラップ後も選択範囲を維持（囲まれた文字列全体を選択）
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
