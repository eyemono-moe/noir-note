/**
 * Bidirectional scroll synchronisation between the CodeMirror editor and the
 * markdown preview pane.
 *
 * Strategy: line-based anchor mapping.
 * - The preview renders block elements with `data-source-line` attributes.
 * - When the editor scrolls, we locate the first visible source line and scroll
 *   the preview to the corresponding anchor (interpolating between anchors for
 *   smooth motion).
 * - When the preview scrolls, we reverse-map the visible anchor back to a line
 *   number and scroll the editor to that position.
 *
 * Loop prevention: two boolean flags (`suppressEditorEvents` /
 * `suppressPreviewEvents`) block the *counterpart* listener for one RAF after
 * each programmatic scroll, preventing the sync from bouncing back and forth.
 *
 * Performance: anchor positions are cached and invalidated lazily via
 * MutationObserver (DOM content changes) and ResizeObserver (pane resize).
 * The expensive querySelectorAll + getBoundingClientRect pass therefore runs
 * at most once per content/layout change rather than on every scroll frame.
 */

import type { EditorView } from "@codemirror/view";
import { type Accessor, createEffect, onCleanup } from "solid-js";

import {
  collectAnchors,
  getEditorLineForPreviewScrollTop,
  getPreviewScrollTopForLine,
  type ScrollAnchor,
} from "../utils/scrollSync";

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
  previewContainer: Accessor<HTMLElement | undefined>,
  enabled: Accessor<boolean>,
): void {
  /**
   * When `suppressEditorEvents` is true, the editor scroll handler is a no-op.
   * This is set before we programmatically scroll the editor (from preview sync)
   * and cleared one RAF later so that the resulting scroll event is ignored.
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

  // ── Anchor cache ──────────────────────────────────────────────────────────
  // Re-collecting anchors (querySelectorAll + N × getBoundingClientRect) on
  // every scroll frame is expensive. Instead we cache the result and invalidate
  // it whenever the preview DOM changes (MutationObserver) or the container is
  // resized (ResizeObserver). The next scroll event after invalidation triggers
  // a fresh collection.

  let anchorCache: ScrollAnchor[] | null = null;
  const invalidateAnchors = () => {
    anchorCache = null;
  };
  const getAnchors = (container: HTMLElement): ScrollAnchor[] =>
    (anchorCache ??= collectAnchors(container));

  createEffect(() => {
    const preview = previewContainer();
    if (!preview) return;

    // Invalidate when child nodes are added/removed (content re-render)
    const mo = new MutationObserver(invalidateAnchors);
    mo.observe(preview, { childList: true, subtree: true });

    // Invalidate when the pane is resized (text reflow shifts element positions)
    const ro = new ResizeObserver(invalidateAnchors);
    ro.observe(preview);

    onCleanup(() => {
      mo.disconnect();
      ro.disconnect();
      anchorCache = null;
    });
  });

  // ── Editor → Preview ──────────────────────────────────────────────────────

  createEffect(() => {
    const view = editorView();
    if (!view || !enabled()) return;

    const handleEditorScroll = () => {
      if (suppressEditorEvents) return;

      // Throttle: at most one pending sync per direction
      if (previewRaf !== null) return;

      previewRaf = requestAnimationFrame(() => {
        previewRaf = null;

        const preview = previewContainer();
        if (!preview || !enabled()) return;

        const topLine = getEditorTopLine(view);
        const anchors = getAnchors(preview);
        if (anchors.length === 0) return;

        const targetScrollTop = getPreviewScrollTopForLine(anchors, topLine);

        // Skip if already at target (avoids unnecessary event firing)
        if (Math.abs(preview.scrollTop - targetScrollTop) < 1) return;

        suppressPreviewEvents = true;
        preview.scrollTop = targetScrollTop;
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
    const preview = previewContainer();
    if (!preview || !enabled()) return;

    const handlePreviewScroll = () => {
      if (suppressPreviewEvents) return;

      if (editorRaf !== null) return;

      editorRaf = requestAnimationFrame(() => {
        editorRaf = null;

        const view = editorView();
        if (!view || !enabled()) return;

        const anchors = getAnchors(preview);
        if (anchors.length === 0) return;

        const targetLine = getEditorLineForPreviewScrollTop(anchors, preview.scrollTop);
        const currentTopLine = getEditorTopLine(view);

        // Skip if already at target
        if (targetLine === currentTopLine) return;

        suppressEditorEvents = true;
        scrollEditorToLine(view, targetLine);
        requestAnimationFrame(() => {
          suppressEditorEvents = false;
        });
      });
    };

    preview.addEventListener("scroll", handlePreviewScroll, { passive: true });
    onCleanup(() => {
      preview.removeEventListener("scroll", handlePreviewScroll);
      if (editorRaf !== null) {
        cancelAnimationFrame(editorRaf);
        editorRaf = null;
      }
    });
  });
}
