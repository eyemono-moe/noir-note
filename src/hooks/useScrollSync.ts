/**
 * Bidirectional scroll synchronisation between the CodeMirror editor and the
 * active preview pane.
 *
 * Strategy: adapter-based line mapping.
 * - Each preview renderer (Markdown, Slide, …) exposes a `PreviewScrollAdapter`
 *   that knows how to map between source line numbers and its own scroll
 *   position.
 * - This hook wires the editor and the adapter together bidirectionally.
 *
 * Loop prevention: two boolean flags (`suppressEditorEvents` /
 * `suppressPreviewEvents`) block the *counterpart* listener for one RAF after
 * each programmatic scroll, preventing the sync from bouncing back and forth.
 */

import type { EditorView } from "@codemirror/view";
import { type Accessor, createEffect, onCleanup } from "solid-js";

import type { PreviewScrollAdapter } from "../types/scrollSync";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Scroll the editor view to the given 1-indexed line without triggering sync. */
function scrollEditorToLine(view: EditorView, line: number): void {
  const clamped = Math.max(1, Math.min(line, view.state.doc.lines));
  const pos = view.state.doc.line(clamped).from;
  const block = view.lineBlockAt(pos);
  view.scrollDOM.scrollTop = block.top;
}

/** Return the 1-indexed line number of the first visible line in the editor. */
function getEditorTopLine(view: EditorView): number {
  const scrollTop = view.scrollDOM.scrollTop;
  const block = view.lineBlockAtHeight(scrollTop);
  return view.state.doc.lineAt(block.from).number;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useScrollSync(
  editorView: Accessor<EditorView | undefined>,
  previewAdapter: Accessor<PreviewScrollAdapter | undefined>,
  enabled: Accessor<boolean>,
): void {
  /**
   * When `suppressEditorEvents` is true, the editor scroll handler is a no-op.
   * Set before programmatic editor scroll (from preview sync) and cleared after.
   */
  let suppressEditorEvents = false;

  /**
   * When `suppressPreviewEvents` is true, the preview scroll handler is a no-op.
   * Set before programmatic preview scroll (from editor sync) and cleared after.
   */
  let suppressPreviewEvents = false;

  // Per-direction pending RAF handles (one outstanding sync per direction).
  let editorRaf: number | null = null;
  let previewRaf: number | null = null;

  // ── Editor → Preview ──────────────────────────────────────────────────────

  createEffect(() => {
    const view = editorView();
    if (!view || !enabled()) return;

    const handleEditorScroll = () => {
      if (suppressEditorEvents) return;

      // Throttle: at most one pending sync per direction.
      if (previewRaf !== null) return;

      previewRaf = requestAnimationFrame(() => {
        previewRaf = null;

        const adapter = previewAdapter();
        if (!adapter || !enabled()) return;

        const topLine = getEditorTopLine(view);

        suppressPreviewEvents = true;
        adapter.syncFromEditorLine(topLine);
        requestAnimationFrame(() => {
          suppressPreviewEvents = false;
        });
      });
    };

    view.scrollDOM.addEventListener("scroll", handleEditorScroll, { passive: true });
    onCleanup(() => {
      view.scrollDOM.removeEventListener("scroll", handleEditorScroll);
      if (previewRaf !== null) {
        cancelAnimationFrame(previewRaf);
        previewRaf = null;
      }
    });
  });

  // ── Preview → Editor ──────────────────────────────────────────────────────

  createEffect(() => {
    const adapter = previewAdapter();
    if (!adapter || !enabled()) return;

    const handlePreviewScroll = () => {
      if (suppressPreviewEvents) return;

      if (editorRaf !== null) return;

      editorRaf = requestAnimationFrame(() => {
        editorRaf = null;

        const view = editorView();
        if (!view || !enabled()) return;

        const targetLine = adapter.getTopSourceLine();
        const currentTopLine = getEditorTopLine(view);

        // Skip if already at target.
        if (targetLine === currentTopLine) return;

        suppressEditorEvents = true;
        scrollEditorToLine(view, targetLine);
        requestAnimationFrame(() => {
          suppressEditorEvents = false;
        });
      });
    };

    const cleanup = adapter.subscribeScroll(handlePreviewScroll);
    onCleanup(() => {
      cleanup();
      if (editorRaf !== null) {
        cancelAnimationFrame(editorRaf);
        editorRaf = null;
      }
    });
  });
}
