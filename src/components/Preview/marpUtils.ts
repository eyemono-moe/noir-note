/**
 * Utilities for mapping Marp slide indices to source line numbers.
 *
 * Line ranges are built from `marpit_slide_open` token positions extracted by
 * Marp's own markdown-it tokenizer (see `renderWithMarp` in `SlideRenderer.tsx`).
 *
 * Using `marpit_slide_open` (rather than bare `hr` tokens) means the mapping
 * is accurate for ALL forms of slide separation that Marp supports:
 *   - Thematic breaks: `---`, `***`, `___`, …
 *   - `headingDivider` directive (slide break on heading level N)
 *   - Any future Marp/Marpit slide-splitting mechanism
 *
 * Each `marpit_slide_open` token carries a `map: [startLine, endLine]` pair
 * (0-indexed) where `map[0]` is the first line of that slide in the source.
 * The frontmatter block is consumed by Marpit's own frontmatter rule and does
 * NOT appear as a `marpit_slide_open` token, so it is automatically excluded.
 */

/** A 1-indexed, inclusive line range for one slide. */
interface SlideLineRange {
  /** First source line of this slide (1-indexed). */
  start: number;
  /** Last source line of this slide (1-indexed, inclusive). */
  end: number;
}

/**
 * Build one `SlideLineRange` per slide from the 1-indexed start line of each
 * `marpit_slide_open` token.
 *
 * @param slideStartLines  1-indexed line numbers where each slide begins.
 *                         Obtain via:
 *                         ```ts
 *                         marp.markdown.parse(content, {})
 *                           .filter(t => t.type === "marpit_slide_open" && t.map)
 *                           .map(t => t.map[0] + 1)
 *                         ```
 * @param totalLines  Total number of lines in the source document.
 */
export function buildSlideLineRanges(
  slideStartLines: number[],
  totalLines: number,
): SlideLineRange[] {
  if (slideStartLines.length === 0) {
    return [{ start: 1, end: totalLines }];
  }

  return slideStartLines.map((startLine, i) => ({
    start: startLine,
    // The slide ends one line before the next slide begins, or at the last
    // line of the document for the final slide.
    end: i + 1 < slideStartLines.length ? slideStartLines[i + 1] - 1 : totalLines,
  }));
}

/**
 * Given a list of slide line ranges, return the 0-based slide index that
 * contains the given 1-based source line.
 *
 * Falls back to 0 (first slide) when `line` is before any known slide start.
 */
export function slideIndexForLine(ranges: SlideLineRange[], line: number): number {
  for (let i = ranges.length - 1; i >= 0; i--) {
    if (ranges[i].start <= line) return i;
  }
  return 0;
}

export type { SlideLineRange };
