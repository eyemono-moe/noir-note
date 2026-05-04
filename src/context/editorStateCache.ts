import type { EditorState } from "@codemirror/state";

type StateSerializer = (state: EditorState) => unknown;
type StateDeserializer = (data: unknown) => EditorState | null;

interface CacheEntry {
  state: EditorState;
  docHash: string;
}

/**
 * LRU cache for EditorState by memo path with document hash verification.
 * Stores EditorState alongside a hash of its document content to detect
 * stale cache when the memo was edited in another tab or client.
 */
export class EditorStateLRUCache {
  private cache = new Map<string, CacheEntry | { serialized: unknown; docHash: string }>();
  private maxSize: number;
  private serializer?: StateSerializer;
  private deserializer?: StateDeserializer;

  constructor(options?: {
    maxSize?: number;
    serializer?: StateSerializer;
    deserializer?: StateDeserializer;
  }) {
    this.maxSize = options?.maxSize ?? 10;
    this.serializer = options?.serializer;
    this.deserializer = options?.deserializer;
  }

  private computeDocHash(content: string): string {
    // Simple hash: just combine length and first/last chars for quick staleness check
    return `${content.length}:${content.charCodeAt(0) ?? 0}:${content.charCodeAt(content.length - 1) ?? 0}`;
  }

  save(path: string, state: EditorState): void {
    const docHash = this.computeDocHash(state.doc.toString());

    // If serializer provided, store serialized form alongside hash (lighter/portable)
    const entry: CacheEntry = {
      state,
      docHash,
    };

    const cacheValue = this.serializer ? { serialized: this.serializer(state), docHash } : entry;

    // Update LRU
    this.cache.delete(path);
    this.cache.set(path, cacheValue);

    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
  }

  /**
   * Attempts to load cached EditorState and returns it only if the document hash matches.
   * Returns null if not cached or if content hash doesn't match (stale cache).
   */
  load(path: string, currentContent: string): EditorState | null {
    const entry = this.cache.get(path);
    if (!entry) return null;

    // Promote to recently used
    this.cache.delete(path);
    this.cache.set(path, entry);

    const currentHash = this.computeDocHash(currentContent);
    let cachedEntry: CacheEntry | null = null;

    if (entry && typeof entry === "object" && "docHash" in entry && "state" in entry) {
      // Direct entry (not serialized)
      cachedEntry = entry as CacheEntry;
    } else if (entry && typeof entry === "object" && "docHash" in entry && "serialized" in entry) {
      // Serialized entry
      const obj = entry as unknown as { docHash: string; serialized: unknown };
      if (this.deserializer) {
        const deserialized = this.deserializer(obj.serialized);
        if (deserialized) {
          cachedEntry = { state: deserialized, docHash: obj.docHash };
        }
      }
    }

    // Stale cache check: only return if hash matches
    if (cachedEntry && cachedEntry.docHash === currentHash) {
      return cachedEntry.state;
    }

    return null;
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
