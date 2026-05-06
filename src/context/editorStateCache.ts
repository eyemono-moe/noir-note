import type { EditorState } from "@codemirror/state";

interface CacheEntry {
  state: EditorState;
  /** Hash of the document content at save time, used to detect stale entries. */
  docHash: string;
}

/**
 * LRU cache for CodeMirror EditorState keyed by memo path.
 *
 * Each entry stores the EditorState alongside a hash of its document content.
 * On load, the hash is compared against the current content so that edits made
 * in another tab (or by an external sync) invalidate the cached state rather
 * than restoring stale history.
 */
export class EditorStateLRUCache {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly maxSize: number;

  constructor(options?: { maxSize?: number }) {
    this.maxSize = options?.maxSize ?? 10;
  }

  private computeDocHash(content: string): string {
    // Cheap fingerprint combining length and boundary characters.
    // Good enough for staleness detection; not a cryptographic hash.
    return `${content.length}:${content.charCodeAt(0) ?? 0}:${content.charCodeAt(content.length - 1) ?? 0}`;
  }

  save(path: string, state: EditorState): void {
    const docHash = this.computeDocHash(state.doc.toString());

    // Re-insert to promote to most-recently-used (Map preserves insertion order).
    this.cache.delete(path);
    this.cache.set(path, { state, docHash });

    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
  }

  /**
   * Return the cached EditorState for `path` if it exists and its document
   * matches `currentContent`. Returns `null` if not cached or stale.
   */
  load(path: string, currentContent: string): EditorState | null {
    const entry = this.cache.get(path);
    if (!entry) return null;

    // Promote to most-recently-used.
    this.cache.delete(path);
    this.cache.set(path, entry);

    if (entry.docHash !== this.computeDocHash(currentContent)) return null;
    return entry.state;
  }

  clear(path: string): void {
    this.cache.delete(path);
  }

  clearAll(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}
