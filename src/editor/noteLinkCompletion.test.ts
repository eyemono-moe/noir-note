import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { describe, expect, test } from "vite-plus/test";

import { noteLinkCompletionSource } from "./noteLinkCompletion";

const memos = [
  {
    path: "/notes/today",
    createdAt: 1,
    updatedAt: 3,
    metadata: { title: "Today", tags: ["daily"] },
  },
  {
    path: "/notes/project-alpha",
    createdAt: 1,
    updatedAt: 2,
    metadata: { title: "Project Alpha", tags: ["work"] },
  },
  {
    path: "/archive/old note",
    createdAt: 1,
    updatedAt: 1,
  },
];

function contextAt(doc: string, pos: number, explicit = false) {
  const state = EditorState.create({ doc, selection: { anchor: pos } });
  return new CompletionContext(state, pos, explicit);
}

describe("noteLinkCompletionSource", () => {
  test("returns markdown-link options for a [[ trigger", () => {
    const result = noteLinkCompletionSource({
      context: contextAt("See [[pro", 9),
      memos,
      currentPath: "/notes/today",
    });

    expect(result).toMatchObject({ from: 4, to: 9, filter: false });
    expect(result?.options).toEqual([
      expect.objectContaining({
        label: "Project Alpha",
        detail: "/notes/project-alpha",
        apply: "[Project Alpha](project-alpha)",
      }),
    ]);
  });

  test("returns null when no candidates match", () => {
    expect(
      noteLinkCompletionSource({
        context: contextAt("See [[missing", 13),
        memos,
        currentPath: "/notes/today",
      }),
    ).toBeNull();
  });

  test("does not trigger inside an existing word", () => {
    expect(
      noteLinkCompletionSource({
        context: contextAt("abc[[pro", 8),
        memos,
        currentPath: "/notes/today",
      }),
    ).toBeNull();
  });

  test("excludes the current note from options", () => {
    const result = noteLinkCompletionSource({
      context: contextAt("[[", 2),
      memos,
      currentPath: "/notes/today",
    });

    expect(result?.options.map((option) => option.label)).toEqual(["Project Alpha", "old note"]);
  });
});
