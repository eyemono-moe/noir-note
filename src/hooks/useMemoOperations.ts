import { debounce } from "@solid-primitives/scheduled";
import { useLocation } from "@solidjs/router";
import { eq, useLiveQuery } from "@tanstack/solid-db";
import { type Accessor, createMemo, createSignal } from "solid-js";

import { useMemosCollection } from "../context/db";
import { AUTO_SAVE_DELAY } from "../utils/constants";
import { parseFrontmatter } from "../utils/frontmatter";
import { normalizePath } from "../utils/path";

/**
 * Hook for saving and updating memos
 * Returns a debounced save function and immediate save function
 */
export function useMemoSaver() {
  const collection = useMemosCollection();
  const location = useLocation();

  // Derive current path from URL so existingMemoQuery is already tracking
  // the right path before saveImmediate is ever called.  Using a separate
  // signal that is set inside saveImmediate causes a same-tick race: the
  // reactive query hasn't re-run yet when we read it right after setSignal().
  const currentPath = createMemo(() => normalizePath(location.pathname));

  const existingMemoQuery = useLiveQuery((q) => {
    const path = currentPath();
    if (!path) return null;

    return q
      .from({ memos: collection })
      .where(({ memos }) => eq(memos.path, path))
      .select(({ memos }) => memos);
  });

  const saveImmediate = (path: string, content: string) => {
    try {
      const now = Date.now();
      const { metadata } = parseFrontmatter(content);

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
  const collection = useMemosCollection();

  // Query for current memo
  const currentMemoQuery = useLiveQuery((q) => {
    const currentPath = path();
    return q
      .from({ memos: collection })
      .where(({ memos }) => eq(memos.path, currentPath))
      .select(({ memos }) => memos)
      .findOne();
  });

  // Synchronously derived DB content — updates atomically with path changes because
  // TanStack DB is an in-memory store and useLiveQuery re-evaluates synchronously.
  // Using createMemo (not createSignal+createEffect) eliminates the two-tick problem
  // where path and content would update in separate reactive batches.
  const dbContent = createMemo(() => currentMemoQuery()?.content ?? "");

  // Local override for immediate user-edit feedback.
  // Stored as {path, content} so that edits from the previous path are automatically
  // ignored when path changes — no explicit reset effect required.
  const [localEdit, setLocalEdit] = createSignal<{ path: string; content: string } | null>(null);

  // Final content: prefer local edit when it matches the current path, else DB content.
  const content = createMemo(() => {
    const edit = localEdit();
    return edit?.path === path() ? edit.content : dbContent();
  });

  const setContent = (newContent: string) => {
    setLocalEdit({ path: path(), content: newContent });
  };

  return {
    content,
    setContent,
    isReady: () => currentMemoQuery.isReady,
  };
}
