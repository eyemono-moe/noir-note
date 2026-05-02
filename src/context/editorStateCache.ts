import type { EditorState } from "@codemirror/state";

type StateSerializer = (state: EditorState) => unknown;
type StateDeserializer = (data: unknown) => EditorState | null;

/**
 * LRU cache for EditorState by memo path.
 * Configurable max size and optional serializer hooks for offloading.
 */
export class EditorStateLRUCache {
  private cache = new Map<string, unknown>();
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

  save(path: string, state: EditorState): void {
    // If serializer provided, store serialized form (lighter/portable)
    const entry = this.serializer ? this.serializer(state) : state;

    // Update LRU
    this.cache.delete(path);
    this.cache.set(path, entry);

    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
  }

  load(path: string): EditorState | null {
    const entry = this.cache.get(path);
    if (!entry) return null;

    // Promote to recently used
    this.cache.delete(path);
    this.cache.set(path, entry);

    if (this.deserializer) {
      const maybeState = this.deserializer(entry);
      if (maybeState) return maybeState;
    }

    // If stored entry is already an EditorState, return it.
    return (entry as EditorState) || null;
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
