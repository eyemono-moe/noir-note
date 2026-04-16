import { rxdbCollectionOptions } from "@tanstack/rxdb-db-collection";
import { createCollection } from "@tanstack/solid-db";

import type { MemoDocument, NoirNotesDatabase } from "./rxdb";

/**
 * Create TanStack DB collection from RxDB
 */
export function createMemosCollection(rxdb: NoirNotesDatabase) {
  console.log("[TanStack DB] Creating memos collection...");

  const collection = createCollection(
    rxdbCollectionOptions<MemoDocument>({
      rxCollection: rxdb.memos,
      startSync: true, // Start syncing immediately
    }),
  );

  console.log("[TanStack DB] Memos collection created successfully");

  return collection;
}

/**
 * Type for the memos collection
 */
export type MemosCollection = ReturnType<typeof createMemosCollection>;
