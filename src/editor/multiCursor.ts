import { selectLineDown, selectLineUp } from "@codemirror/commands";
import { selectNextOccurrence, selectSelectionMatches } from "@codemirror/search";
import { EditorSelection, EditorState } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { keymap, rectangularSelection, crosshairCursor, drawSelection } from "@codemirror/view";

/**
 * Pure helper: collapse a multi-range selection down to its primary range.
 * Returns null when the selection already has a single range so callers can
 * decide whether to fall back to other behavior (e.g. native Escape handling).
 */
export function collapseToPrimarySelection(selection: EditorSelection): EditorSelection | null {
  if (selection.ranges.length <= 1) return null;
  return EditorSelection.create([selection.main]);
}

const escapeToSinglePrimaryCursor = (view: EditorView): boolean => {
  const next = collapseToPrimarySelection(view.state.selection);
  if (!next) return false;
  view.dispatch({ selection: next });
  return true;
};

// `selectLine{Up,Down}` extends the primary selection. For
// "add cursor above/below" we want the new head to become an additional cursor
// while preserving existing ranges.
const simplifyToCursors = (view: EditorView): boolean => {
  const { selection } = view.state;
  const ranges = selection.ranges.map((range) => EditorSelection.cursor(range.head));
  view.dispatch({
    selection: EditorSelection.create(ranges, selection.mainIndex),
  });
  return true;
};

const addCursorAbove = (view: EditorView): boolean => selectLineUp(view) && simplifyToCursors(view);

const addCursorBelow = (view: EditorView): boolean =>
  selectLineDown(view) && simplifyToCursors(view);

/**
 * Multi-cursor / multi-selection editor extension.
 *
 * Adds VSCode-style multi-cursor primitives on top of CodeMirror 6:
 * - allowMultipleSelections: state-level enablement of multi-range selections.
 * - Alt+Click: add a cursor at the click position.
 * - rectangularSelection / crosshairCursor: standard CodeMirror block-select.
 * - Mod-Alt-ArrowUp / Mod-Alt-ArrowDown: add cursor above/below current line.
 * - Mod-D: add the next match of the current selection / word to the selection.
 * - Mod-Shift-L: select all matches of the current selection / word.
 * - Escape: collapse a multi-cursor state to the primary selection only.
 *
 * The Escape binding returns `false` for single-range selections so other
 * consumers (search panel close, default behavior) continue to work.
 */
export const multiCursorExtension: Extension = [
  EditorState.allowMultipleSelections.of(true),
  // CodeMirror's default selection rendering relies on the browser's native
  // selection, which only paints the primary range. `drawSelection` is required
  // for secondary cursors / selections to be visible at all.
  drawSelection(),
  EditorView.clickAddsSelectionRange.of((event) => event.altKey),
  rectangularSelection(),
  crosshairCursor(),
  keymap.of([
    { key: "Mod-Alt-ArrowUp", run: addCursorAbove, preventDefault: true },
    { key: "Mod-Alt-ArrowDown", run: addCursorBelow, preventDefault: true },
    { key: "Mod-d", run: selectNextOccurrence, preventDefault: true },
    { key: "Mod-Shift-l", run: selectSelectionMatches, preventDefault: true },
    { key: "Escape", run: escapeToSinglePrimaryCursor },
  ]),
];
