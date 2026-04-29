import type { RootContent } from "mdast";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { type KeyedEntry, _resetKeyCounter, lcsRootMatch, withStableRootKeys } from "./reconcile";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal RootContent node of the given type (no position data needed). */
function node(type: RootContent["type"]): RootContent {
  if (type === "paragraph") return { type, children: [] };
  if (type === "heading") return { type, depth: 2, children: [] };
  if (type === "code") return { type, value: "" };
  if (type === "blockquote") return { type, children: [] };
  if (type === "list") return { type, ordered: false, spread: false, children: [] };
  if (type === "thematicBreak") return { type };
  if (type === "html") return { type, value: "" };
  if (type === "table") return { type, align: [], children: [] };
  // fallback – cast for any other valid type
  return { type } as unknown as RootContent;
}

function entry(key: string, nodeType: string): KeyedEntry {
  return { key, nodeType };
}

// ---------------------------------------------------------------------------
// lcsRootMatch
// ---------------------------------------------------------------------------

describe("lcsRootMatch", () => {
  it("returns empty matches for empty inputs", () => {
    expect(lcsRootMatch([], [])).toEqual([]);
    expect(lcsRootMatch([entry("k1", "paragraph")], [])).toEqual([]);
    expect(lcsRootMatch([], [node("paragraph")])).toEqual([]);
  });

  it("matches identical sequences 1-to-1", () => {
    const prev = [entry("k1", "paragraph"), entry("k2", "code"), entry("k3", "heading")];
    const next = [node("paragraph"), node("code"), node("heading")];
    expect(lcsRootMatch(prev, next)).toEqual([
      { prevIdx: 0, nextIdx: 0 },
      { prevIdx: 1, nextIdx: 1 },
      { prevIdx: 2, nextIdx: 2 },
    ]);
  });

  it("insertion at the beginning: old nodes shift right, new node gets no match", () => {
    // old: [p, code, h2]   new: [NEW_p, p, code, h2]
    const prev = [entry("k1", "paragraph"), entry("k2", "code"), entry("k3", "heading")];
    const next = [node("paragraph"), node("paragraph"), node("code"), node("heading")];
    // LCS = [paragraph, code, heading].
    // Backtrack from (3,4):
    //   h2==h2  → match prev[2]↔next[3]  → (2,3)
    //   code==code → match prev[1]↔next[2] → (1,2)
    //   p==p    → match prev[0]↔next[1]  → (0,1)  ← next[0] (new node) left unmatched
    // Result: next[0] is fresh; next[1..3] reuse old keys. Code block keeps its key. ✓
    expect(lcsRootMatch(prev, next)).toEqual([
      { prevIdx: 0, nextIdx: 1 },
      { prevIdx: 1, nextIdx: 2 },
      { prevIdx: 2, nextIdx: 3 },
    ]);
  });

  it("insertion at the end", () => {
    const prev = [entry("k1", "paragraph"), entry("k2", "code")];
    const next = [node("paragraph"), node("code"), node("heading")];
    expect(lcsRootMatch(prev, next)).toEqual([
      { prevIdx: 0, nextIdx: 0 },
      { prevIdx: 1, nextIdx: 1 },
    ]);
    // new[2] (heading) gets a fresh key
  });

  it("deletion: omitted node gets no match", () => {
    // old: [p, code, h2]   new: [p, h2]  (code deleted)
    const prev = [entry("k1", "paragraph"), entry("k2", "code"), entry("k3", "heading")];
    const next = [node("paragraph"), node("heading")];
    expect(lcsRootMatch(prev, next)).toEqual([
      { prevIdx: 0, nextIdx: 0 },
      { prevIdx: 2, nextIdx: 1 },
    ]);
  });

  it("type change is treated as delete + insert (no match)", () => {
    const prev = [entry("k1", "paragraph")];
    const next = [node("heading")];
    expect(lcsRootMatch(prev, next)).toEqual([]);
  });

  it("multiple identical-type siblings matched positionally", () => {
    // 3 paragraphs stay 3 paragraphs
    const prev = [entry("k1", "paragraph"), entry("k2", "paragraph"), entry("k3", "paragraph")];
    const next = [node("paragraph"), node("paragraph"), node("paragraph")];
    expect(lcsRootMatch(prev, next)).toEqual([
      { prevIdx: 0, nextIdx: 0 },
      { prevIdx: 1, nextIdx: 1 },
      { prevIdx: 2, nextIdx: 2 },
    ]);
  });

  it("insert paragraph above 3 identical paragraphs: new one gets no prev match", () => {
    // old: [p1, p2, p3]   new: [p_new, p1, p2, p3]
    const prev = [entry("k1", "paragraph"), entry("k2", "paragraph"), entry("k3", "paragraph")];
    const next = [node("paragraph"), node("paragraph"), node("paragraph"), node("paragraph")];
    // LCS length = 3. Backtrack from (3,4):
    //   p==p → prev[2]↔next[3] → (2,3)
    //   p==p → prev[1]↔next[2] → (1,2)
    //   p==p → prev[0]↔next[1] → (0,1)  ← next[0] (new node) left unmatched
    // Result: next[0] is fresh; next[1..3] reuse old keys. ✓
    const matches = lcsRootMatch(prev, next);
    expect(matches).toHaveLength(3);
    expect(matches.map((m) => m.prevIdx)).toEqual([0, 1, 2]);
    expect(matches.map((m) => m.nextIdx)).toEqual([1, 2, 3]);
  });
});

// ---------------------------------------------------------------------------
// withStableRootKeys
// ---------------------------------------------------------------------------

describe("withStableRootKeys", () => {
  afterEach(() => _resetKeyCounter());

  it("assigns fresh keys to all nodes on first render (empty prevKeyed)", () => {
    const root = {
      type: "root" as const,
      children: [node("paragraph"), node("code")],
    };
    const { root: keyed, newKeyed } = withStableRootKeys(root, []);

    expect(newKeyed).toHaveLength(2);
    expect(newKeyed[0].nodeType).toBe("paragraph");
    expect(newKeyed[1].nodeType).toBe("code");
    // Keys are fresh (k1, k2) and distinct
    expect(newKeyed[0].key).not.toBe(newKeyed[1].key);
    // The keyed root children have _$$rckey set
    expect((keyed.children[0] as any)._$$rckey).toBe(newKeyed[0].key);
    expect((keyed.children[1] as any)._$$rckey).toBe(newKeyed[1].key);
  });

  it("reuses keys for unchanged nodes on second render", () => {
    const root1 = {
      type: "root" as const,
      children: [node("paragraph"), node("code")],
    };
    const { newKeyed: prev } = withStableRootKeys(root1, []);

    const root2 = {
      type: "root" as const,
      children: [node("paragraph"), node("code")],
    };
    const { root: keyed2, newKeyed: next } = withStableRootKeys(root2, prev);

    // Keys should be identical (reused from prev)
    expect(next[0].key).toBe(prev[0].key);
    expect(next[1].key).toBe(prev[1].key);
    expect((keyed2.children[0] as any)._$$rckey).toBe(prev[0].key);
    expect((keyed2.children[1] as any)._$$rckey).toBe(prev[1].key);
  });

  it("gives inserted node a fresh key without changing keys of existing nodes", () => {
    // Render 1: [paragraph, code]
    const root1 = {
      type: "root" as const,
      children: [node("paragraph"), node("code")],
    };
    const { newKeyed: prev } = withStableRootKeys(root1, []);
    const codeKey = prev[1].key;

    // Render 2: [heading (new), paragraph, code]
    const root2 = {
      type: "root" as const,
      children: [node("heading"), node("paragraph"), node("code")],
    };
    const { root: keyed2, newKeyed: next } = withStableRootKeys(root2, prev);

    expect(next).toHaveLength(3);
    // heading is new → fresh key
    expect(next[0].key).not.toBe(prev[0].key);
    expect(next[0].key).not.toBe(prev[1].key);
    // paragraph reuses its old key
    expect(next[1].key).toBe(prev[0].key);
    // code reuses its old key (critical: no remount of SyntaxHighlightedCode)
    expect(next[2].key).toBe(codeKey);
    // Verify _$$rckey in the output tree
    expect((keyed2.children[2] as any)._$$rckey).toBe(codeKey);
  });

  it("gives deleted node's slot to the next matching node", () => {
    // Render 1: [paragraph, code, heading]
    const root1 = {
      type: "root" as const,
      children: [node("paragraph"), node("code"), node("heading")],
    };
    const { newKeyed: prev } = withStableRootKeys(root1, []);
    const [pKey, codeKey, h2Key] = prev.map((e) => e.key);

    // Render 2: [paragraph, heading]  (code deleted)
    const root2 = {
      type: "root" as const,
      children: [node("paragraph"), node("heading")],
    };
    const { newKeyed: next } = withStableRootKeys(root2, prev);

    expect(next).toHaveLength(2);
    expect(next[0].key).toBe(pKey); // paragraph survives
    expect(next[1].key).toBe(h2Key); // heading survives
    expect(next.map((e) => e.key)).not.toContain(codeKey); // code key retired
  });

  it("intra-block children receive index-based _$$rckey (unchanged behaviour)", () => {
    const root = {
      type: "root" as const,
      children: [
        {
          type: "paragraph" as const,
          children: [
            { type: "text" as const, value: "hello" },
            { type: "text" as const, value: "world" },
          ],
        },
      ],
    };
    const { root: keyed } = withStableRootKeys(root, []);
    const para = keyed.children[0] as any;
    // Children of paragraph keep index:type pattern
    expect(para.children[0]._$$rckey).toBe("0:text");
    expect(para.children[1]._$$rckey).toBe("1:text");
  });
});
