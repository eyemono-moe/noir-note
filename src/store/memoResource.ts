import { createResource, createSignal } from "solid-js";

import type { IStorage } from "../storage";
import type { Memo } from "../types/memo";

/**
 * Reactive memo management using createResource
 *
 * Design principles:
 * - Single resource for all memos (memos list is source of truth)
 * - No automatic refetch after save (local state already has correct value)
 * - Refetch only when needed (after delete, or manual refresh)
 * - Use findMemo to get individual memos from the list
 */
export function createMemoResource(storage: IStorage) {
  // Trigger for manual refetch (using equals: false means any call to setRefetchTrigger will trigger)
  const [refetchTrigger, setRefetchTrigger] = createSignal(0, { equals: () => false });

  // Resource for all memos - single source of truth
  const [memos] = createResource(refetchTrigger, async () => {
    console.log("[memoResource] Fetching all memos");
    try {
      const result = await storage.list();
      console.log("[memoResource] Fetched memos count:", result.length);
      return result;
    } catch (error) {
      console.error("Failed to load memos:", error);
      throw error;
    }
  });

  // Save memo - does NOT trigger refetch
  // The local state already has the correct value, no need to refetch
  const saveMemo = async (path: string, content: string): Promise<boolean> => {
    console.log("[memoResource] saveMemo called:", { path, contentLength: content.length });
    try {
      await storage.set(path, content);
      console.log("[memoResource] storage.set completed (no refetch)");
      setRefetchTrigger(0); // Optionally trigger refetch to update list (e.g. for new memos), but not needed for updates
      return true;
    } catch (error) {
      console.error(`Failed to save memo at ${path}:`, error);
      return false;
    }
  };

  // Delete memo - triggers refetch to update the list
  const deleteMemo = async (path: string): Promise<boolean> => {
    console.log("[memoResource] deleteMemo called:", { path });
    try {
      await storage.delete(path);
      console.log("[memoResource] storage.delete completed, triggering refetch");
      setRefetchTrigger(0); // Trigger refetch after delete
      return true;
    } catch (error) {
      console.error(`Failed to delete memo at ${path}:`, error);
      return false;
    }
  };

  // Get memos as array (derived from resource)
  const memosArray = (): Memo[] => {
    return memos() ?? [];
  };

  // Get memo by path from list (derived, not a separate resource)
  const findMemo = (path: string): Memo | undefined => {
    return memosArray().find((m) => m.path === path);
  };

  return {
    // Resources
    memos, // Resource<Memo[] | undefined>

    // Derived accessors
    memosArray, // () => Memo[]
    findMemo, // (path: string) => Memo | undefined

    // Mutators
    saveMemo, // (path: string, content: string) => Promise<boolean> - no refetch
    deleteMemo, // (path: string) => Promise<boolean> - triggers refetch

    // Manual refetch (for explicit refresh)
    refetch: () => {
      console.log("[memoResource] Manual refetch triggered");
      setRefetchTrigger(0);
    },
  };
}

export type MemoResource = ReturnType<typeof createMemoResource>;
