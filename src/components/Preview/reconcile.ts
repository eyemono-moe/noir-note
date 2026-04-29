import type { Root, RootContent } from "mdast";

// ============================================================================
// Block-level container types
// ============================================================================

/**
 * Node types whose `children` array contains block-level nodes.
 * LCS diffing is applied at these levels so that inserting or deleting a
 * sibling does not shift keys and cause expensive re-mounts further down
 * the tree (e.g. ImageNode losing its object URL, CodeNode re-highlighting).
 *
 * Inline containers (paragraph, heading, emphasis, …) are intentionally
 * excluded: their children change on every keystroke, so LCS overhead would
 * outweigh the benefit — and inline nodes rarely carry expensive component state.
 */
const BLOCK_CONTAINER_TYPES = new Set([
  "blockquote", // children: block nodes (code, list, paragraph, …)
  "list", //       children: listItem[]
  "listItem", //   children: block nodes (paragraph, nested list, …)
  "footnoteDefinition", // children: block nodes
]);

// ============================================================================
// KeyedEntry
// ============================================================================

/**
 * Metadata stored for each keyed node after a render, used to match nodes
 * across successive parses.
 */
export interface KeyedEntry {
  /** The stable `_$$rckey` assigned to this node. */
  key: string;
  /** The mdast node type (e.g. "paragraph", "code"). Used as the LCS predicate. */
  nodeType: string;
  /**
   * Keyed children — present only when this node is a BLOCK_CONTAINER_TYPES
   * node. Carried across renders so that nested arrays can also be LCS-matched.
   */
  children?: KeyedEntry[];
}

// ============================================================================
// Key counter
// ============================================================================

/**
 * Module-level counter that generates globally unique keys for new nodes.
 * Monotonically increasing — never reused even across component instances.
 */
let _globalKeyCounter = 0;

/** Reset the counter (test use only). */
export function _resetKeyCounter(): void {
  _globalKeyCounter = 0;
}

// ============================================================================
// LCS matching
// ============================================================================

/**
 * Compute the Longest Common Subsequence between `prev` and `next` using
 * `nodeType` equality as the match predicate.
 *
 * Returns matched index pairs `{ prevIdx, nextIdx }` in ascending order.
 * Unmatched entries in `next` will receive fresh keys.
 *
 * Complexity: O(m·n) time and space — acceptable for typical sibling counts
 * at any level (root blocks, list items, blockquote paragraphs).
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
  // the beginning of the array, the new node stays unmatched (fresh key) while
  // all the old nodes match their shifted counterparts — exactly what we want.
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

// ============================================================================
// Recursive keying
// ============================================================================

/**
 * Apply `_$$rckey` to a node and all its descendants using only index-based
 * keys. Used for inline containers (paragraph, heading, emphasis, …) where LCS
 * overhead is not warranted and inline nodes don't carry expensive state.
 */
function keyNodeIndexBased(node: RootContent, localKey: string): any {
  const keyed: any = { ...node, _$$rckey: localKey };
  if ("children" in keyed && Array.isArray(keyed.children)) {
    keyed.children = (keyed.children as RootContent[]).map((child, i) =>
      keyNodeIndexBased(child, `${i}:${child.type}`),
    );
  }
  return keyed;
}

/**
 * Key a single node, applying LCS-based stable keys recursively for
 * BLOCK_CONTAINER_TYPES children and index-based keys for inline children.
 *
 * Returns both the keyed node (ready for the store) and the updated
 * `KeyedEntry` metadata to carry into the next render.
 */
function keyNode(
  node: RootContent,
  key: string,
  prevEntry: KeyedEntry | undefined,
): { keyed: any; entry: KeyedEntry } {
  const keyed: any = { ...node, _$$rckey: key };

  if (BLOCK_CONTAINER_TYPES.has(node.type) && "children" in node && Array.isArray(node.children)) {
    // Block-level children: apply LCS recursively
    const { keyedChildren, newEntries } = keyBlockChildren(
      node.children as RootContent[],
      prevEntry?.children ?? [],
    );
    keyed.children = keyedChildren;
    return { keyed, entry: { key, nodeType: node.type, children: newEntries } };
  }

  if ("children" in node && Array.isArray(node.children)) {
    // Inline children: index-based keys, no entry tracking
    keyed.children = (node.children as RootContent[]).map((child, i) =>
      keyNodeIndexBased(child, `${i}:${child.type}`),
    );
  }

  return { keyed, entry: { key, nodeType: node.type } };
}

/**
 * LCS-match `children` against `prevEntries`, assign stable or fresh keys,
 * and recurse into block-level containers.
 *
 * Total complexity across all levels: O(Σᵢ mᵢ·nᵢ) where the sum is over
 * every block-level child array in the tree. For a typical 200-node document
 * this is well under 1 ms.
 */
function keyBlockChildren(
  children: readonly RootContent[],
  prevEntries: readonly KeyedEntry[],
): { keyedChildren: any[]; newEntries: KeyedEntry[] } {
  const matches = lcsRootMatch(prevEntries, children);
  const matchedByNext = new Map(matches.map(({ prevIdx, nextIdx }) => [nextIdx, prevIdx]));

  const newEntries: KeyedEntry[] = [];
  const keyedChildren = children.map((child, j) => {
    const prevIdx = matchedByNext.get(j);
    const key =
      prevIdx !== undefined
        ? prevEntries[prevIdx].key // reuse existing key → no remount
        : `k${++_globalKeyCounter}`; // fresh key for inserted node
    const prevEntry = prevIdx !== undefined ? prevEntries[prevIdx] : undefined;
    const { keyed, entry } = keyNode(child, key, prevEntry);
    newEntries.push(entry);
    return keyed;
  });

  return { keyedChildren, newEntries };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Assign stable `_$$rckey` values throughout the AST, reusing keys from
 * `prevKeyed` wherever the LCS match finds a corresponding node.
 *
 * - Root children and all BLOCK_CONTAINER_TYPES descendants receive LCS-based
 *   stable keys so that insertion/deletion at any block level does not cascade
 *   re-mounts down the tree.
 * - Inline children receive index-based keys (cheaper, sufficient for nodes
 *   that don't carry expensive component state).
 *
 * Returns the keyed root (ready for `reconcile`) and the updated `KeyedEntry[]`
 * to store for the next render.
 */
export function withStableRootKeys(
  root: Root,
  prevKeyed: readonly KeyedEntry[],
): { root: Root; newKeyed: KeyedEntry[] } {
  const { keyedChildren, newEntries } = keyBlockChildren(root.children, prevKeyed);
  return { root: { ...root, children: keyedChildren } as Root, newKeyed: newEntries };
}
