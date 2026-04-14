import type { Memo } from "../types/memo";
import type { IStorage } from "./interface";

export class MemoryStorage implements IStorage {
  private memos = new Map<string, Memo>();

  async get(path: string): Promise<Memo | null> {
    return this.memos.get(path) || null;
  }

  async set(path: string, content: string): Promise<void> {
    const existing = this.memos.get(path);
    const now = Date.now();

    const memo: Memo = {
      path,
      content,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.memos.set(path, memo);
  }

  async delete(path: string): Promise<void> {
    this.memos.delete(path);
  }

  async list(): Promise<Memo[]> {
    return Array.from(this.memos.values());
  }

  async clear(): Promise<void> {
    this.memos.clear();
  }
}
