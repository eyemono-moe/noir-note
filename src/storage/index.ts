import { IndexedDBStorage } from "./indexeddb";
import type { IStorage } from "./interface";
import { MemoryStorage } from "./memory";

export function createStorage(): IStorage {
  // Check if IndexedDB is available
  if (typeof window !== "undefined" && window.indexedDB) {
    try {
      return new IndexedDBStorage();
    } catch (error) {
      console.warn("IndexedDB not available, falling back to memory storage", error);
      return new MemoryStorage();
    }
  }

  // Fallback to memory storage
  return new MemoryStorage();
}

export type { IStorage } from "./interface";
export { IndexedDBStorage } from "./indexeddb";
export { MemoryStorage } from "./memory";
