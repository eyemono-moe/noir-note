import { createFromBuffer, type Formatter } from "@dprint/formatter";
import diff from "fast-diff";

let formatter: Formatter | null = null;

// メインスレッドから渡されるデータ型
export interface FormatRequest {
  text: string;
  wasmUrl: string;
  requestId: number;
}

// メインスレッドに返すデータ型
export interface FormatResponse {
  changes?: { from: number; to: number; insert: string }[];
  error?: string;
  requestId: number;
}

self.onmessage = async (e: MessageEvent<FormatRequest>) => {
  const { text, wasmUrl, requestId } = e.data;

  try {
    if (!formatter) {
      const response = await fetch(wasmUrl);
      const buffer = await response.arrayBuffer();
      formatter = createFromBuffer(buffer);
      formatter.setConfig({ indentWidth: 2, lineWidth: 80 }, {});
    }

    const formatted = formatter.formatText({
      filePath: "file.md",
      fileText: text,
    });

    if (formatted === text) {
      self.postMessage({ changes: [], requestId });
      return;
    }

    const diffs = diff(text, formatted);

    // 差分をCodeMirrorのchangeSpec形式に変換
    const changes: { from: number; to: number; insert: string }[] = [];
    let currentPos = 0;
    for (const [type, value] of diffs) {
      if (type === diff.EQUAL) {
        currentPos += value.length;
      } else if (type === diff.INSERT) {
        changes.push({ from: currentPos, to: currentPos, insert: value });
      } else if (type === diff.DELETE) {
        changes.push({ from: currentPos, to: currentPos + value.length, insert: "" });
        currentPos += value.length;
      }
    }

    self.postMessage({ changes, requestId } satisfies FormatResponse);
  } catch (err) {
    self.postMessage({ error: String(err), requestId } satisfies FormatResponse);
  }
};
