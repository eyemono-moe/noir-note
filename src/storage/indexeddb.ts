import { openDB, type IDBPDatabase } from "idb";
import type { Memo } from "../types/memo";
import { DB_NAME, DB_VERSION, STORE_NAME } from "../utils/constants";
import type { IStorage } from "./interface";

export class IndexedDBStorage implements IStorage {
  private dbPromise: Promise<IDBPDatabase>;

  constructor() {
    this.dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "path" });
        }
      },
    });
  }

  async get(path: string): Promise<Memo | null> {
    const db = await this.dbPromise;
    const memo = await db.get(STORE_NAME, path);
    return memo || null;
  }

  async set(path: string, content: string): Promise<void> {
    const db = await this.dbPromise;
    const existing = await db.get(STORE_NAME, path);
    const now = Date.now();

    const memo: Memo = {
      path,
      content,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await db.put(STORE_NAME, memo);
  }

  async delete(path: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(STORE_NAME, path);
  }

  async list(): Promise<Memo[]> {
    const db = await this.dbPromise;
    return db.getAll(STORE_NAME);
  }

  async clear(): Promise<void> {
    const db = await this.dbPromise;
    await db.clear(STORE_NAME);
  }
}
