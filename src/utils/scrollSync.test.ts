import { describe, expect, test } from "vite-plus/test";

import {
  getEditorLineForPreviewScrollTop,
  getPreviewScrollTopForLine,
  type ScrollAnchor,
} from "./scrollSync";

// ---------------------------------------------------------------------------
// getPreviewScrollTopForLine
// ---------------------------------------------------------------------------

describe("getPreviewScrollTopForLine", () => {
  test("returns 0 for empty anchors", () => {
    expect(getPreviewScrollTopForLine([], 5)).toBe(0);
  });

  test("returns first anchor top when target is before first anchor", () => {
    const anchors: ScrollAnchor[] = [
      { line: 5, top: 100 },
      { line: 10, top: 200 },
    ];
    expect(getPreviewScrollTopForLine(anchors, 1)).toBe(100);
    expect(getPreviewScrollTopForLine(anchors, 5)).toBe(100);
  });

  test("returns last anchor top when target is after last anchor", () => {
    const anchors: ScrollAnchor[] = [
      { line: 1, top: 0 },
      { line: 10, top: 300 },
    ];
    expect(getPreviewScrollTopForLine(anchors, 10)).toBe(300);
    expect(getPreviewScrollTopForLine(anchors, 20)).toBe(300);
  });

  test("interpolates linearly between two anchors", () => {
    const anchors: ScrollAnchor[] = [
      { line: 1, top: 0 },
      { line: 11, top: 100 },
    ];
    // Midpoint: line 6 → top 50
    expect(getPreviewScrollTopForLine(anchors, 6)).toBe(50);
    // Quarter: line 3.5 (round to 3) → but we pass fractional lines from editor
    expect(getPreviewScrollTopForLine(anchors, 3)).toBe(20);
  });

  test("handles single anchor", () => {
    const anchors: ScrollAnchor[] = [{ line: 5, top: 80 }];
    expect(getPreviewScrollTopForLine(anchors, 1)).toBe(80);
    expect(getPreviewScrollTopForLine(anchors, 5)).toBe(80);
    expect(getPreviewScrollTopForLine(anchors, 100)).toBe(80);
  });

  test("handles multiple anchors with varying gaps", () => {
    const anchors: ScrollAnchor[] = [
      { line: 1, top: 0 },
      { line: 5, top: 200 },
      { line: 10, top: 250 },
    ];
    // Between line 1 and 5: frac = (3-1)/(5-1) = 0.5, top = 0 + 0.5 * 200 = 100
    expect(getPreviewScrollTopForLine(anchors, 3)).toBe(100);
    // Between line 5 and 10: frac = (7-5)/(10-5) = 0.4, top = 200 + 0.4 * 50 = 220
    expect(getPreviewScrollTopForLine(anchors, 7)).toBe(220);
  });

  test("handles anchors with equal line numbers (zero span)", () => {
    const anchors: ScrollAnchor[] = [
      { line: 5, top: 100 },
      { line: 5, top: 150 },
    ];
    // lineSpan = 0 → frac = 0 → returns prev.top
    expect(getPreviewScrollTopForLine(anchors, 5)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// getEditorLineForPreviewScrollTop
// ---------------------------------------------------------------------------

describe("getEditorLineForPreviewScrollTop", () => {
  test("returns 1 for empty anchors", () => {
    expect(getEditorLineForPreviewScrollTop([], 0)).toBe(1);
    expect(getEditorLineForPreviewScrollTop([], 500)).toBe(1);
  });

  test("returns first anchor line when scrollTop is before first anchor", () => {
    const anchors: ScrollAnchor[] = [
      { line: 3, top: 100 },
      { line: 8, top: 200 },
    ];
    expect(getEditorLineForPreviewScrollTop(anchors, 0)).toBe(3);
    expect(getEditorLineForPreviewScrollTop(anchors, 100)).toBe(3);
  });

  test("returns last anchor line when scrollTop is at or beyond last anchor", () => {
    const anchors: ScrollAnchor[] = [
      { line: 1, top: 0 },
      { line: 10, top: 300 },
    ];
    expect(getEditorLineForPreviewScrollTop(anchors, 300)).toBe(10);
    expect(getEditorLineForPreviewScrollTop(anchors, 500)).toBe(10);
  });

  test("interpolates linearly between two anchors", () => {
    const anchors: ScrollAnchor[] = [
      { line: 1, top: 0 },
      { line: 11, top: 100 },
    ];
    // scrollTop 50 → frac = 0.5, line = round(1 + 0.5 * 10) = 6
    expect(getEditorLineForPreviewScrollTop(anchors, 50)).toBe(6);
  });

  test("rounds to nearest line", () => {
    const anchors: ScrollAnchor[] = [
      { line: 1, top: 0 },
      { line: 4, top: 30 },
    ];
    // scrollTop 10 → frac = 10/30 ≈ 0.333, line = round(1 + 0.333*3) = round(2) = 2
    expect(getEditorLineForPreviewScrollTop(anchors, 10)).toBe(2);
  });

  test("handles single anchor", () => {
    const anchors: ScrollAnchor[] = [{ line: 7, top: 200 }];
    expect(getEditorLineForPreviewScrollTop(anchors, 0)).toBe(7);
    expect(getEditorLineForPreviewScrollTop(anchors, 200)).toBe(7);
    expect(getEditorLineForPreviewScrollTop(anchors, 999)).toBe(7);
  });

  test("handles anchors with equal top values (zero span)", () => {
    const anchors: ScrollAnchor[] = [
      { line: 5, top: 100 },
      { line: 8, top: 100 },
    ];
    // topSpan = 0 → frac = 0 → returns prev.line = 5
    expect(getEditorLineForPreviewScrollTop(anchors, 100)).toBe(5);
  });

  test("round-trip symmetry: editor→preview→editor", () => {
    const anchors: ScrollAnchor[] = [
      { line: 1, top: 0 },
      { line: 5, top: 100 },
      { line: 10, top: 180 },
      { line: 20, top: 400 },
    ];
    for (const line of [1, 3, 5, 8, 10, 15, 20]) {
      const previewTop = getPreviewScrollTopForLine(anchors, line);
      const backLine = getEditorLineForPreviewScrollTop(anchors, previewTop);
      expect(backLine).toBe(line);
    }
  });
});
