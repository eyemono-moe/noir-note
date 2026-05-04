/**
 * Adapter interface implemented by each preview renderer (Markdown, Slide, …).
 *
 * `useScrollSync` talks exclusively through this interface so that adding a new
 * preview type never requires changes to the sync hook itself.
 */
export interface PreviewScrollAdapter {
  /**
   * Scroll the preview to show the content that corresponds to the given
   * 1-based source line number at the top of the visible area.
   *
   * - MarkdownRenderer: scrolls to the nearest `data-source-line` anchor.
   * - SlideRenderer: scrolls to the slide whose line range contains `line`.
   */
  syncFromEditorLine(line: number): void;

  /**
   * Return the 1-based source line number that is currently at the top of the
   * preview viewport.
   *
   * - MarkdownRenderer: reverse-maps the visible anchor back to a line number.
   * - SlideRenderer: returns the first line of the currently visible slide.
   */
  getTopSourceLine(): number;

  /**
   * Subscribe to scroll events on the preview container.
   * Returns a cleanup function that removes the listener.
   */
  subscribeScroll(handler: () => void): () => void;
}
