import { openDB } from "idb";

import type { Memo } from "../types/memo";
import { DB_NAME, DB_VERSION, STORE_NAME } from "../utils/constants";
import type { NoirNotesDatabase } from "./rxdb";

/**
 * Migrate data from old IndexedDB (idb) to RxDB
 * This function reads all memos from the old database and inserts them into RxDB
 */
export async function migrateFromOldIndexedDB(rxdb: NoirNotesDatabase): Promise<void> {
  console.log("[Migration] Starting migration from old IndexedDB to RxDB...");

  try {
    // Open old database
    const oldDB = await openDB(DB_NAME, DB_VERSION);

    // Check if old store exists
    if (!oldDB.objectStoreNames.contains(STORE_NAME)) {
      console.log("[Migration] No old database found, skipping migration");
      return;
    }

    // Get all memos from old database
    const oldMemos = (await oldDB.getAll(STORE_NAME)) as Memo[];
    console.log(`[Migration] Found ${oldMemos.length} memos in old database`);

    if (oldMemos.length === 0) {
      console.log("[Migration] No memos to migrate");
      return;
    }

    // Insert all memos into RxDB using bulk insert
    const docsToInsert = oldMemos.map((memo) => ({
      path: memo.path,
      content: memo.content,
      createdAt: memo.createdAt,
      updatedAt: memo.updatedAt,
    }));

    await rxdb.memos.bulkInsert(docsToInsert);

    console.log(`[Migration] Successfully migrated ${oldMemos.length} memos to RxDB`);

    // Note: We don't delete the old database here to avoid data loss
    // Users can manually clear it later if needed
    console.log("[Migration] Old database preserved (not deleted)");
  } catch (error) {
    console.error("[Migration] Migration failed:", error);
    throw error;
  }
}
