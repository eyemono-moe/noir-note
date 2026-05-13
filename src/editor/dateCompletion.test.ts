import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { describe, expect, test } from "vite-plus/test";

import { dateCompletionSource } from "./dateCompletion";

function contextAt(doc: string, pos: number, explicit = false): CompletionContext {
  const state = EditorState.create({ doc, selection: { anchor: pos } });
  return new CompletionContext(state, pos, explicit);
}

describe("dateCompletionSource", () => {
  test("returns all five candidates after '@'", () => {
    const ctx = contextAt("@", 1, true);
    const result = dateCompletionSource(ctx);
    expect(result).not.toBeNull();
    expect(result?.options.map((o) => o.label)).toEqual([
      "@today",
      "@yesterday",
      "@tomorrow",
      "@now",
      "@time",
    ]);
  });

  test("filters by prefix after '@'", () => {
    const ctx = contextAt("@to", 3);
    const result = dateCompletionSource(ctx);
    expect(result?.options.map((o) => o.label)).toEqual(["@today", "@tomorrow"]);
  });

  test("includes both from and to so the trigger text is replaced on accept", () => {
    const ctx = contextAt("@today", 6);
    const result = dateCompletionSource(ctx);
    expect(result?.from).toBe(0);
    expect(result?.to).toBe(6);
  });

  test("does not trigger when '@' is preceded by a word character (email-like)", () => {
    // doc: "user@example" → at position 12 (after "@example")
    const ctx = contextAt("user@example", 12);
    const result = dateCompletionSource(ctx);
    expect(result).toBeNull();
  });

  test("returns null when no candidate matches the query", () => {
    const ctx = contextAt("@xyz", 4);
    const result = dateCompletionSource(ctx);
    expect(result).toBeNull();
  });

  test("each apply string is the concrete value (no '@' prefix)", () => {
    const ctx = contextAt("@today", 6);
    const result = dateCompletionSource(ctx);
    const today = result?.options.find((o) => o.label === "@today");
    const apply = today?.apply;
    expect(typeof apply).toBe("string");
    expect(apply as string).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((apply as string).startsWith("@")).toBe(false);
  });
});
