import { describe, expect, test, vi } from "vite-plus/test";

import { openNoteSearchPanel } from "./noteSearch";

describe("openNoteSearchPanel", () => {
  test("opens CodeMirror search and restores focus to the search field", () => {
    const focusEditor = vi.fn<() => void>();
    const openPanel = vi.fn<() => void>();
    const focusPanelInput = vi.fn<() => void>();
    const enqueue = vi.fn<(callback: () => void) => void>((callback) => callback());

    const opened = openNoteSearchPanel({ focus: focusEditor } as never, {
      openPanel,
      focusPanelInput,
      enqueue,
    });

    expect(opened).toBe(true);
    expect(focusEditor).toHaveBeenCalledOnce();
    expect(openPanel).toHaveBeenCalledOnce();
    expect(focusPanelInput).toHaveBeenCalledOnce();
  });

  test("sets the CodeMirror search query before opening the panel", () => {
    const focusEditor = vi.fn<() => void>();
    const dispatch = vi.fn<(spec: unknown) => void>();
    const openPanel = vi.fn<() => void>();
    const focusPanelInput = vi.fn<() => void>();
    const enqueue = vi.fn<(callback: () => void) => void>((callback) => callback());
    const makeSearchQueryEffect = vi.fn<(query: string) => never>((query) => ({ query }) as never);

    const opened = openNoteSearchPanel({ focus: focusEditor, dispatch } as never, {
      query: "sidebar",
      openPanel,
      focusPanelInput,
      enqueue,
      makeSearchQueryEffect,
    });

    expect(opened).toBe(true);
    expect(makeSearchQueryEffect).toHaveBeenCalledWith("sidebar");
    expect(dispatch).toHaveBeenCalledWith({ effects: { query: "sidebar" } });
    expect(openPanel).toHaveBeenCalledOnce();
  });

  test("reports that search could not open when there is no editor view", () => {
    const openPanel = vi.fn<() => void>();

    expect(openNoteSearchPanel(undefined, { openPanel })).toBe(false);
    expect(openPanel).not.toHaveBeenCalled();
  });
});
