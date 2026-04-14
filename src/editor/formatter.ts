import { Transaction } from "@codemirror/state";
import type { Command, KeyBinding } from "@codemirror/view";
import { createFromBuffer, type Formatter } from "@dprint/formatter";
import markdownEasmUrl from "@dprint/markdown/plugin.wasm?url";
let formatter: Formatter | null = null;

async function initFormatter() {
  if (formatter) return formatter;

  // Wasmファイルをフェッチ
  const response = await fetch(markdownEasmUrl);
  const buffer = await response.arrayBuffer();

  formatter = createFromBuffer(buffer);

  // 設定を適用
  formatter.setConfig(
    {
      indentWidth: 2,
      lineWidth: 80,
    },
    {},
  );
  return formatter;
}

initFormatter(); // フォーマッタの初期化を先に行っておく

async function formatMarkdown(text: string) {
  const f = await initFormatter();
  // 第1引数はファイル名（拡張子でプラグインを判別するため重要）
  return f.formatText({
    filePath: "file.md",
    fileText: text,
  });
}

const formatCommand: Command = (target) => {
  const { state, dispatch, scrollDOM } = target;

  const content = state.doc.toString();

  // スクロール位置を保存
  // [NOTE] scrollSnapshotでエラーが発生しているので手動で保存するように変更
  // const snapshot = scrollSnapshot();

  // 現在の値を保持
  const prevScrollTop = scrollDOM.scrollTop;
  const prevScrollLeft = scrollDOM.scrollLeft;

  // 非同期で処理を実行
  formatMarkdown(content)
    .then((formatted) => {
      if (formatted === content) return; // 変更がない場合は何もしない

      // ドキュメント全体を置換するトランザクションを発行
      dispatch(
        state.update({
          changes: { from: 0, to: state.doc.length, insert: formatted },
          selection: state.selection.map(state.changes()),
          annotations: Transaction.userEvent.of("format"), // ユーザーイベントを付与
          // effects: snapshot, // スクロール位置を復元
        }),
      );

      // スクロール位置を復元
      requestAnimationFrame(() => {
        scrollDOM.scrollTop = prevScrollTop;
        scrollDOM.scrollLeft = prevScrollLeft;
      });
    })
    .catch((err) => console.error("Format error:", err));

  return true;
};

export const formatKeyBinding: KeyBinding = {
  key: "Mod-Shift-f",
  run: formatCommand,
};
