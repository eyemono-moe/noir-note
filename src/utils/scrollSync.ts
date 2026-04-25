/**
 * Utilities for bidirectional scroll synchronisation between the editor and preview panes.
 *
 * These are pure functions with no DOM dependencies so they can be unit-tested easily.
 */

/** A mapping point: a source line number and its pixel offset from the top of the scrollable content */
export interface ScrollAnchor {
  /** 1-indexed source line number from mdast node.position.start.line */
  line: number;
  /** Pixel offset from the top of the scrollable container (container.scrollTop value where element just reaches the top) */
  top: number;
}

/**
 * Given a sorted list of anchor points and a target source line number,
 * returns the preview scrollTop that puts that line at the top of the viewport.
 *
 * Interpolates between surrounding anchors for smooth mapping.
 */
export function getPreviewScrollTopForLine(
  anchors: readonly ScrollAnchor[],
  targetLine: number,
): number {
  if (anchors.length === 0) return 0;

  const first = anchors[0];
  const last = anchors[anchors.length - 1];

  if (targetLine <= first.line) return first.top;
  if (targetLine >= last.line) return last.top;

  for (let i = 0; i < anchors.length - 1; i++) {
    const prev = anchors[i];
    const next = anchors[i + 1];
    if (targetLine >= prev.line && targetLine <= next.line) {
      const lineSpan = next.line - prev.line;
      const topSpan = next.top - prev.top;
      const frac = lineSpan === 0 ? 0 : (targetLine - prev.line) / lineSpan;
      return prev.top + frac * topSpan;
    }
  }

  return last.top;
}

/**
 * Given a sorted list of anchor points and the current scrollTop of the preview container,
 * returns the source line number that corresponds to the top of the visible area.
 *
 * Interpolates between surrounding anchors for smooth mapping.
 */
export function getEditorLineForPreviewScrollTop(
  anchors: readonly ScrollAnchor[],
  scrollTop: number,
): number {
  if (anchors.length === 0) return 1;

  const first = anchors[0];
  const last = anchors[anchors.length - 1];

  if (scrollTop <= first.top) return first.line;
  if (scrollTop >= last.top) return last.line;

  for (let i = 0; i < anchors.length - 1; i++) {
    const prev = anchors[i];
    const next = anchors[i + 1];
    if (scrollTop >= prev.top && scrollTop <= next.top) {
      const topSpan = next.top - prev.top;
      const lineSpan = next.line - prev.line;
      const frac = topSpan === 0 ? 0 : (scrollTop - prev.top) / topSpan;
      return Math.round(prev.line + frac * lineSpan);
    }
  }

  return last.line;
}

/**
 * Collect anchor data from the preview DOM container.
 * Queries all elements with `data-source-line` and computes their position
 * relative to the top of the scrollable content.
 */
export function collectAnchors(container: HTMLElement): ScrollAnchor[] {
  const elements = container.querySelectorAll<HTMLElement>("[data-source-line]");
  const containerRect = container.getBoundingClientRect();
  const anchors: ScrollAnchor[] = [];

  for (const el of elements) {
    const line = parseInt(el.getAttribute("data-source-line")!, 10);
    if (isNaN(line)) continue;
    const elRect = el.getBoundingClientRect();
    // top relative to scrollable content (independent of current scroll position)
    const top = elRect.top - containerRect.top + container.scrollTop;
    anchors.push({ line, top });
  }

  // Ensure sorted by line (DOM order should already guarantee this, but be safe)
  anchors.sort((a, b) => a.line - b.line);
  return anchors;
}
