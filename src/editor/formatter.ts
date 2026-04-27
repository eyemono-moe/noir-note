import { Transaction } from "@codemirror/state";
import type { Command, KeyBinding } from "@codemirror/view";
import markdownWasmUrl from "@dprint/markdown/plugin.wasm?url";

import type { FormatRequest, FormatResponse } from "../workers/formatter.worker";
// oxlint-disable-next-line import/default --- needed for worker import
import formatWorker from "../workers/formatter.worker?worker";

class FormatService {
  private worker: Worker | null = null;
  private currentRequestId = 0;

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new formatWorker();
    }
    return this.worker;
  }

  async requestFormat(text: string): Promise<FormatResponse["changes"]> {
    const requestId = ++this.currentRequestId;
    const worker = this.getWorker();

    return new Promise((resolve, reject) => {
      const handler = (e: MessageEvent<FormatResponse>) => {
        if (e.data.requestId !== requestId) return;
        worker.removeEventListener("message", handler);

        if (e.data.error) reject(e.data.error);
        else resolve(e.data.changes);
      };

      worker.addEventListener("message", handler);
      worker.postMessage({
        text,
        wasmUrl: markdownWasmUrl,
        requestId,
      } satisfies FormatRequest);
    });
  }
}

const formatService = new FormatService();

const formatCommand: Command = (target) => {
  // oxlint-disable-next-line typescript/unbound-method
  const { state, dispatch } = target;
  const content = state.doc.toString();

  formatService
    .requestFormat(content)
    .then((changes) => {
      if (!changes || changes.length === 0) return;

      dispatch(
        state.update({
          changes: changes,
          annotations: Transaction.userEvent.of("format"),
        }),
      );
    })
    .catch((err) => console.error("dprint format error:", err));

  return true;
};

export const formatKeyBindings: KeyBinding[] = [
  { key: "Mod-Shift-f", run: formatCommand },
  { key: "Mod-s", run: formatCommand },
];
