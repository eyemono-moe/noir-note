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
 * Binary search: returns the index of the last anchor where `anchor[key] <= value`.
 * Assumes `anchors` is sorted ascending by `key`.
 * Returns -1 if every anchor is greater than `value` (caller must handle).
 */
function binarySearchFloor(
  anchors: readonly ScrollAnchor[],
  value: number,
  key: keyof ScrollAnchor,
): number {
  let lo = 0;
  let hi = anchors.length - 1;
  let result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (anchors[mid][key] <= value) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
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

  // Binary search: find the last anchor whose line ≤ targetLine
  const i = binarySearchFloor(anchors, targetLine, "line");
  const prev = anchors[i];
  const next = anchors[i + 1];

  const lineSpan = next.line - prev.line;
  const topSpan = next.top - prev.top;
  const frac = lineSpan === 0 ? 0 : (targetLine - prev.line) / lineSpan;
  return prev.top + frac * topSpan;
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

  // Binary search: find the last anchor whose top ≤ scrollTop
  const i = binarySearchFloor(anchors, scrollTop, "top");
  const prev = anchors[i];
  const next = anchors[i + 1];

  const topSpan = next.top - prev.top;
  const lineSpan = next.line - prev.line;
  const frac = topSpan === 0 ? 0 : (scrollTop - prev.top) / topSpan;
  return Math.round(prev.line + frac * lineSpan);
}

/**
 * Collect anchor data from the preview DOM container.
 * Queries all elements with `data-source-line` and computes their position
 * relative to the top of the scrollable content.
 *
 * Elements are returned in DOM order, which matches source-line order by
 * construction (the renderer emits nodes in AST order).
 * All getBoundingClientRect() calls are batched (reads only, no DOM writes),
 * so the browser performs a single layout flush for the entire loop.
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

  return anchors;
}
