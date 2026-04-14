import { createStore } from "solid-js/store";
import type { Memo } from "../types/memo";
import type { IStorage } from "../storage";

interface MemoStoreState {
  memos: Map<string, Memo>;
  loading: boolean;
  error: string | null;
}

const [memoStore, setMemoStore] = createStore<MemoStoreState>({
  memos: new Map(),
  loading: false,
  error: null,
});

export { memoStore };

export const memoActions = {
  async loadAll(storage: IStorage) {
    setMemoStore("loading", true);
    setMemoStore("error", null);

    try {
      const list = await storage.list();
      const memoMap = new Map(list.map((memo) => [memo.path, memo]));
      setMemoStore("memos", memoMap);
    } catch (error) {
      setMemoStore("error", error instanceof Error ? error.message : "Failed to load memos");
    } finally {
      setMemoStore("loading", false);
    }
  },

  async get(path: string, storage: IStorage): Promise<Memo | null> {
    // Check if already in store
    const cached = memoStore.memos.get(path);
    if (cached) {
      return cached;
    }

    // Load from storage
    try {
      const memo = await storage.get(path);
      if (memo) {
        setMemoStore("memos", (memos) => {
          const newMemos = new Map(memos);
          newMemos.set(path, memo);
          return newMemos;
        });
      }
      return memo;
    } catch (error) {
      setMemoStore("error", error instanceof Error ? error.message : "Failed to get memo");
      return null;
    }
  },

  async save(path: string, content: string, storage: IStorage, fromSync = false) {
    try {
      await storage.set(path, content);

      // Update store
      const existing = memoStore.memos.get(path);
      const now = Date.now();

      setMemoStore("memos", (memos) => {
        const newMemos = new Map(memos);
        newMemos.set(path, {
          path,
          content,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        });
        return newMemos;
      });

      return { success: true, fromSync };
    } catch (error) {
      setMemoStore("error", error instanceof Error ? error.message : "Failed to save memo");
      return { success: false, fromSync };
    }
  },

  async delete(path: string, storage: IStorage) {
    try {
      await storage.delete(path);

      setMemoStore("memos", (memos) => {
        const newMemos = new Map(memos);
        newMemos.delete(path);
        return newMemos;
      });
    } catch (error) {
      setMemoStore("error", error instanceof Error ? error.message : "Failed to delete memo");
    }
  },

  clearError() {
    setMemoStore("error", null);
  },
};
