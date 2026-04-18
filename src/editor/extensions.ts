import { history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { defaultKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { bracketMatching, indentUnit } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import { EditorView, highlightWhitespace } from "@codemirror/view";
import { lineNumbers, highlightActiveLineGutter, highlightActiveLine } from "@codemirror/view";
import { keymap } from "@codemirror/view";

import { formatKeyBindings } from "./formatter";
import { darkTheme, lightTheme } from "./theme";

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

    keymap.of(defaultKeymap), // defaultKeymapを有効化
    keymap.of(historyKeymap), // historyKeymapを有効化
    keymap.of([indentWithTab]), // タブキーをbindしてインデントの上げ下げに使用する。入力される文字列はindentUnitで設定する
    indentUnit.of("  "), // インデントの単位をスペース4個にする。@codemirror/lang-markdownでネストしたリストに正しい挙動をさせるには2-5の範囲にする必要がある
    EditorView.lineWrapping, // テキストの折返しを有効化
    EditorState.tabSize.of(2), // Tab（\t）をスペース4個分の大きさにする
    keymap.of(formatKeyBindings), // フォーマット用のキーバインドを有効化

    // Language support
    markdown(),

    [highlightWhitespace(), highlightWhitespaceTheme], // 空白文字を可視化する（スペースは点、タブは矢印で表示される）

    // Theme
    ...(isDark ? darkTheme : lightTheme),
  ];
}
