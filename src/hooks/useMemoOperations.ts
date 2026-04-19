import { debounce } from "@solid-primitives/scheduled";
import { eq, useLiveQuery } from "@tanstack/solid-db";
import { type Accessor, createEffect, createSignal } from "solid-js";

import { useMemosCollection } from "../context/db";
import { AUTO_SAVE_DELAY } from "../utils/constants";
import { parseFrontmatter } from "../utils/frontmatter";

/**
 * Hook for saving and updating memos
 * Returns a debounced save function and immediate save function
 */
export function useMemoSaver() {
  const memosCollectionResource = useMemosCollection();

  // Track existing memo to determine insert vs update
  const [currentPath, setCurrentPath] = createSignal("");

  const existingMemoQuery = useLiveQuery((q) => {
    const collection = memosCollectionResource();
    if (!collection) return null;

    const path = currentPath();
    if (!path) return null;

    return q
      .from({ memos: collection })
      .where(({ memos }) => eq(memos.path, path))
      .select(({ memos }) => memos);
  });

  const saveImmediate = (path: string, content: string) => {
    const collection = memosCollectionResource();
    if (!collection) {
      console.error("[useMemoSaver] Cannot save: collection not ready");
      return;
    }

    try {
      const now = Date.now();
      const { metadata } = parseFrontmatter(content);

      // Update current path for query
      setCurrentPath(path);

      // Check if memo exists in query result
      const memos = existingMemoQuery();
      const existing = memos?.[0];

      if (existing) {
        // Update existing memo
        collection.update(path, (draft) => {
          draft.content = content;
          draft.updatedAt = now;
          draft.metadata = metadata;
        });
      } else {
        // Insert new memo
        collection.insert({
          path,
          content,
          createdAt: now,
          updatedAt: now,
          metadata,
        });
      }
    } catch (error) {
      console.error("[useMemoSaver] Save failed:", error);
    }
  };

  const debouncedSave = debounce(saveImmediate, AUTO_SAVE_DELAY);

  return {
    save: debouncedSave,
    saveImmediate,
  };
}

/**
 * Hook for managing memo content with auto-sync
 */
export function useMemoContent(path: Accessor<string>) {
  const memosCollectionResource = useMemosCollection();
  const [localContent, setLocalContent] = createSignal("");

  // Query for current memo
  const currentMemoQuery = useLiveQuery((q) => {
    const collection = memosCollectionResource();
    if (!collection) return null;

    const currentPath = path();
    return q
      .from({ memos: collection })
      .where(({ memos }) => eq(memos.path, currentPath))
      .select(({ memos }) => memos);
  });

  // Sync memo to local content when it changes
  createEffect(() => {
    const memos = currentMemoQuery();
    const memo = memos?.[0];
    if (memo) {
      setLocalContent(memo.content);
    } else if (currentMemoQuery.isReady) {
      setLocalContent("");
    }
  });

  return {
    content: localContent,
    setContent: setLocalContent,
    isReady: () => currentMemoQuery.isReady,
  };
}
