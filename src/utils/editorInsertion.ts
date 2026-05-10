import type { ChangeSpec, EditorState } from "@codemirror/state";
import { EditorSelection } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

/**
 * Snippet placeholders supported by {@link computeInsertion}.
 *
 * - `$0` — final cursor position. Stripped from the inserted text.
 * - `$selection` — replaced with the text of the range that is being replaced
 *   (either the explicit `replace` range or the primary selection). When the
 *   replace range is empty, this expands to an empty string.
 *
 * The first occurrence of each marker wins. `$0` placement takes precedence
 * over the post-insertion fallback (cursor at end of inserted text).
 */
export interface InsertionSpec {
  /** Snippet body, with optional `$0` / `$selection` markers. */
  snippet: string;
  /**
   * Optional explicit document range to replace. When omitted the primary
   * selection range is used (which is `from === to` for a bare cursor).
   */
  replace?: { from: number; to: number };
}

interface InsertionTransaction {
  changes: ChangeSpec;
  selection: ReturnType<typeof EditorSelection.cursor>;
}

const CURSOR_MARKER = "$0";
const SELECTION_MARKER = "$selection";

/**
 * Compute the document changes + new selection for inserting `snippet` into
 * `state`. Pure: no side effects, suitable for unit tests and reuse from
 * inline-trigger code paths.
 */
export function computeInsertion(state: EditorState, spec: InsertionSpec): InsertionTransaction {
  const range = spec.replace ?? {
    from: state.selection.main.from,
    to: state.selection.main.to,
  };
  const selectedText = range.from === range.to ? "" : state.sliceDoc(range.from, range.to);

  // Substitute $selection placeholders first so $0 indexing is computed against
  // the final inserted text length.
  const withSelection = spec.snippet.split(SELECTION_MARKER).join(selectedText);

  const cursorIdx = withSelection.indexOf(CURSOR_MARKER);
  const insert =
    cursorIdx === -1
      ? withSelection
      : withSelection.slice(0, cursorIdx) + withSelection.slice(cursorIdx + CURSOR_MARKER.length);

  const cursorOffset = cursorIdx === -1 ? insert.length : cursorIdx;
  const cursorPos = range.from + cursorOffset;

  return {
    changes: { from: range.from, to: range.to, insert },
    selection: EditorSelection.cursor(cursorPos),
  };
}

/**
 * Convenience wrapper: dispatch the computed insertion transaction onto
 * `view`. Returns `false` when no view is available so command code can fall
 * back to other behavior (e.g. show a toast).
 */
export function insertIntoEditor(view: EditorView | undefined, spec: InsertionSpec): boolean {
  if (!view) return false;
  const tx = computeInsertion(view.state, spec);
  view.dispatch({
    changes: tx.changes,
    selection: tx.selection,
    scrollIntoView: true,
  });
  view.focus();
  return true;
}
