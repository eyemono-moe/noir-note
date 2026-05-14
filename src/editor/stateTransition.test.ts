// @vitest-environment jsdom

import { autocompletion } from "@codemirror/autocomplete";
import { EditorState, StateEffect } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";

import { ensureEditorExtensions } from "./stateTransition";

const views: EditorView[] = [];
let originalRaf: typeof globalThis.requestAnimationFrame;
let originalCancelRaf: typeof globalThis.cancelAnimationFrame;

beforeEach(() => {
  originalRaf = globalThis.requestAnimationFrame;
  originalCancelRaf = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback) =>
    setTimeout(() => callback(performance.now()), 0) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
});

afterEach(() => {
  for (const view of views.splice(0)) view.destroy();
  globalThis.requestAnimationFrame = originalRaf;
  globalThis.cancelAnimationFrame = originalCancelRaf;
});

function createView() {
  const parent = document.createElement("div");
  document.body.append(parent);
  const view = new EditorView({
    parent,
    state: EditorState.create({ doc: "initial" }),
  });
  views.push(view);
  return view;
}

describe("ensureEditorExtensions", () => {
  test("reinstalls dynamic extension compartment after setState replaces the editor state", () => {
    const view = createView();
    const extensions = [lineNumbers(), autocompletion()];

    ensureEditorExtensions(view, extensions);
    expect(view.dom.querySelector(".cm-lineNumbers")).not.toBeNull();

    view.setState(EditorState.create({ doc: "next" }));
    expect(view.dom.querySelector(".cm-lineNumbers")).toBeNull();

    ensureEditorExtensions(view, extensions);

    expect(view.dom.querySelector(".cm-lineNumbers")).not.toBeNull();
  });

  test("reconfigures existing compartment without appending duplicate configuration", () => {
    const view = createView();
    const extensions = [lineNumbers(), autocompletion()];

    ensureEditorExtensions(view, extensions);
    ensureEditorExtensions(view, extensions);

    // If ensureEditorExtensions appended a second copy instead of reconfiguring,
    // CodeMirror would throw here because autocompletion owns singleton fields.
    view.dispatch({ effects: StateEffect.appendConfig.of([]) });
    expect(view.dom.querySelector(".cm-lineNumbers")).not.toBeNull();
  });
});
