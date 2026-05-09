import { EditorSelection, EditorState } from "@codemirror/state";
import { describe, expect, test } from "vite-plus/test";

import { collapseToPrimarySelection, multiCursorExtension } from "./multiCursor";

describe("collapseToPrimarySelection", () => {
  test("returns null for single-range selections", () => {
    const sel = EditorSelection.create([EditorSelection.cursor(0)]);
    expect(collapseToPrimarySelection(sel)).toBeNull();
  });

  test("collapses to the main range when multiple ranges exist", () => {
    const sel = EditorSelection.create(
      [EditorSelection.cursor(0), EditorSelection.cursor(5), EditorSelection.cursor(10)],
      1,
    );

    const result = collapseToPrimarySelection(sel);

    expect(result).not.toBeNull();
    expect(result?.ranges.length).toBe(1);
    expect(result?.main.head).toBe(5);
  });
});

describe("multiCursorExtension", () => {
  test("allows EditorState to keep multiple selection ranges", () => {
    const state = EditorState.create({
      doc: "hello world",
      extensions: [multiCursorExtension],
    });

    const tr = state.update({
      selection: EditorSelection.create([EditorSelection.cursor(0), EditorSelection.cursor(6)]),
    });

    expect(tr.newSelection.ranges.length).toBe(2);
  });
});
