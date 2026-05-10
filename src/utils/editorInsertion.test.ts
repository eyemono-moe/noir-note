import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, test } from "vite-plus/test";

import { computeInsertion, insertIntoEditor } from "./editorInsertion";

const stateWithSelection = (doc: string, ranges: { anchor: number; head?: number }[]) =>
  EditorState.create({
    doc,
    selection: EditorSelection.create(
      ranges.map((r) => EditorSelection.range(r.anchor, r.head ?? r.anchor)),
    ),
  });

describe("computeInsertion", () => {
  test("inserts at cursor when no selection range and no explicit range", () => {
    const state = stateWithSelection("abc", [{ anchor: 1 }]);

    const spec = computeInsertion(state, { snippet: "X" });

    expect(spec).toEqual({
      changes: { from: 1, to: 1, insert: "X" },
      selection: EditorSelection.cursor(2),
    });
  });

  test("replaces the primary selection when selection has length", () => {
    const state = stateWithSelection("abcdef", [{ anchor: 1, head: 4 }]);

    const spec = computeInsertion(state, { snippet: "Z" });

    expect(spec.changes).toEqual({ from: 1, to: 4, insert: "Z" });
    expect(spec.selection).toEqual(EditorSelection.cursor(2));
  });

  test("respects an explicit replace range, ignoring current selection", () => {
    const state = stateWithSelection("hello world", [{ anchor: 0 }]);

    const spec = computeInsertion(state, {
      snippet: "MD",
      replace: { from: 6, to: 11 },
    });

    expect(spec.changes).toEqual({ from: 6, to: 11, insert: "MD" });
    expect(spec.selection).toEqual(EditorSelection.cursor(8));
  });

  test("places cursor at $0 marker and strips the marker from inserted text", () => {
    const state = stateWithSelection("", [{ anchor: 0 }]);

    const spec = computeInsertion(state, { snippet: "[label]($0)" });

    expect(spec.changes).toEqual({ from: 0, to: 0, insert: "[label]()" });
    // cursor positioned where `$0` was, after accounting for the offset.
    expect(spec.selection).toEqual(EditorSelection.cursor("[label](".length));
  });

  test("substitutes $selection with the replaced text and positions cursor at end", () => {
    const state = stateWithSelection("the quick fox", [{ anchor: 4, head: 9 }]);

    const spec = computeInsertion(state, { snippet: "[$selection](url)" });

    // selection text is "quick"
    expect(spec.changes).toEqual({ from: 4, to: 9, insert: "[quick](url)" });
    expect(spec.selection).toEqual(EditorSelection.cursor(4 + "[quick](url)".length));
  });

  test("falls back gracefully when both $0 and $selection appear", () => {
    const state = stateWithSelection("ab", [{ anchor: 0, head: 2 }]);

    const spec = computeInsertion(state, { snippet: "<<$selection|$0>>" });

    // selection text is "ab"; $0 wins for cursor placement after substitution
    expect(spec.changes).toEqual({ from: 0, to: 2, insert: "<<ab|>>" });
    expect(spec.selection).toEqual(EditorSelection.cursor("<<ab|".length));
  });
});

describe("insertIntoEditor", () => {
  test("returns false when view is undefined", () => {
    expect(insertIntoEditor(undefined, { snippet: "X" })).toBe(false);
  });

  test("dispatches a transaction that updates the document", () => {
    const view = new EditorView({
      state: EditorState.create({
        doc: "hello",
        selection: EditorSelection.create([EditorSelection.cursor(5)]),
      }),
    });

    const ok = insertIntoEditor(view, { snippet: " world" });

    expect(ok).toBe(true);
    expect(view.state.doc.toString()).toBe("hello world");
    expect(view.state.selection.main.head).toBe("hello world".length);
    view.destroy();
  });

  test("respects $0 placeholder via dispatch", () => {
    const view = new EditorView({
      state: EditorState.create({
        doc: "",
        selection: EditorSelection.create([EditorSelection.cursor(0)]),
      }),
    });

    const ok = insertIntoEditor(view, { snippet: "[](url$0)" });

    expect(ok).toBe(true);
    expect(view.state.doc.toString()).toBe("[](url)");
    expect(view.state.selection.main.head).toBe("[](url".length);
    view.destroy();
  });
});
