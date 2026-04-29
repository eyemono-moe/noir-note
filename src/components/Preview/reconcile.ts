import type { Root, RootContent } from "mdast";

// ============================================================================
// Reconcile key helpers
// ============================================================================

/**
 * Add a synthetic `_$$rckey` property to each node based on its local index and type.
 * This is used as the reconcile key so that nodes of different types at the same
 * array position are treated as different items (new proxy), preventing reconcile
 * from overwriting e.g. a `table` proxy with `code` data, which would cause
 * `children` to be undefined when components still try to read it.
 */
function addReconcileKey(node: RootContent, localKey: string): any {
  const keyed = { ...node, _$$rckey: localKey };
  if ("children" in keyed && Array.isArray(keyed.children)) {
    keyed.children = keyed.children.map((child: RootContent, i: number) =>
      addReconcileKey(child, `${i}:${child.type}`),
    );
  }
  return keyed;
}

// ============================================================================
// Stable root-level key assignment via Myers LCS
// ============================================================================

/**
 * Metadata stored for each root child after a render, used to match nodes
 * across successive parses.
 */
export interface KeyedEntry {
  /** The stable `_$$rckey` assigned to this root node. */
  key: string;
  /** The mdast node type (e.g. "paragraph", "code"). Used as the match predicate. */
  nodeType: string;
}

/**
 * Module-level counter that generates globally unique keys for new root nodes.
 * Monotonically increasing — never reused even across component instances.
 */
let _globalKeyCounter = 0;

/** Reset the counter (test use only). */
export function _resetKeyCounter(): void {
  _globalKeyCounter = 0;
}

/**
 * Compute the Longest Common Subsequence between `prev` and `next` using
 * `nodeType` equality as the match predicate.
 *
 * Returns matched index pairs `{ prevIdx, nextIdx }` in ascending order.
 * Unmatched entries in `next` will receive fresh keys.
 *
 * Complexity: O(m·n) time and space — acceptable for typical document sizes
 * (< 200 root blocks, so < 40 000 cell operations per parse).
 */
export function lcsRootMatch(
  prev: readonly KeyedEntry[],
  next: readonly RootContent[],
): Array<{ prevIdx: number; nextIdx: number }> {
  const m = prev.length;
  const n = next.length;

  // dp[i][j] = length of LCS of prev[0..i-1] and next[0..j-1]
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        prev[i - 1].nodeType === next[j - 1].type
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack to recover the matched pairs.
  // Tiebreak `>=`: when there is ambiguity, skip from `prev` (i--) rather than
  // from `next` (j--). In practice this means that when a node is inserted at
  // the beginning of the document, the new node at next[0] stays unmatched
  // (fresh key) while all the old nodes match their shifted counterparts in
  // `next` — exactly the behaviour we want.
  const matches: Array<{ prevIdx: number; nextIdx: number }> = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (prev[i - 1].nodeType === next[j - 1].type) {
      matches.unshift({ prevIdx: i - 1, nextIdx: j - 1 });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return matches;
}

/**
 * Assign stable `_$$rckey` values to the root children of a new AST, reusing
 * keys from `prevKeyed` wherever the LCS match finds a corresponding node.
 * New (unmatched) nodes receive a fresh `k${counter}` key.
 *
 * Returns both the keyed root (ready for `reconcile`) and the updated
 * `KeyedEntry[]` to store for the next render.
 */
export function withStableRootKeys(
  root: Root,
  prevKeyed: readonly KeyedEntry[],
): { root: Root; newKeyed: KeyedEntry[] } {
  const newChildren = root.children;
  const matches = lcsRootMatch(prevKeyed, newChildren);
  const matchedByNext = new Map(matches.map(({ prevIdx, nextIdx }) => [nextIdx, prevIdx]));

  const newKeyed: KeyedEntry[] = [];
  const keyedChildren = newChildren.map((child, j) => {
    const prevIdx = matchedByNext.get(j);
    const key =
      prevIdx !== undefined
        ? prevKeyed[prevIdx].key // reuse existing key → no remount
        : `k${++_globalKeyCounter}`; // fresh key for inserted node
    newKeyed.push({ key, nodeType: child.type });
    return addReconcileKey(child, key);
  });

  return { root: { ...root, children: keyedChildren } as Root, newKeyed };
}
