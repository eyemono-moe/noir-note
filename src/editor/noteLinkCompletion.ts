import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";

import type { MemoWithoutContent } from "../types/memo";
import {
  buildNoteLinkCandidates,
  formatMarkdownNoteLink,
  getNoteLinkDisplayName,
} from "../utils/noteLinkInsertion";

const NOTE_LINK_TRIGGER_RE = /(?<![\w\]])\[[^\]\n]*/;

export type NoteLinkCompletionContext = {
  memos: readonly MemoWithoutContent[];
  currentPath: string;
};

type NoteLinkCompletionOptions = NoteLinkCompletionContext & {
  context: CompletionContext;
};

function selectedText(context: CompletionContext): string | undefined {
  const range = context.state.selection.main;
  if (range.empty) return undefined;
  return context.state.sliceDoc(range.from, range.to);
}

export function noteLinkCompletionSource({
  context,
  memos,
  currentPath,
}: NoteLinkCompletionOptions): CompletionResult | null {
  const match = context.matchBefore(NOTE_LINK_TRIGGER_RE);
  if (!match) return null;
  if (match.from === match.to && !context.explicit) return null;

  const query = match.text.slice(1).trim();
  const candidates = buildNoteLinkCandidates({ memos, currentPath, query });
  if (candidates.length === 0) return null;

  const labelText = selectedText(context);
  const options: Completion[] = candidates.map((memo) => {
    const displayName = getNoteLinkDisplayName(memo);
    const tags = memo.metadata?.tags?.join(", ");
    return {
      label: displayName,
      detail: memo.path,
      info: tags ? `tags: ${tags}` : undefined,
      apply: formatMarkdownNoteLink({
        currentPath,
        targetPath: memo.path,
        targetTitle: memo.metadata?.title,
        selectedText: labelText,
      }),
    };
  });

  return {
    from: match.from,
    to: match.to,
    options,
    filter: false,
  };
}
