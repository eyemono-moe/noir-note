import { rxdbCollectionOptions } from "@tanstack/rxdb-db-collection";
import { createCollection } from "@tanstack/solid-db";

import type { MemoDocument, NoirNotesDatabase } from "./rxdb";

/**
 * Create TanStack DB collection from RxDB
 */
export function createMemosCollection(rxdb: NoirNotesDatabase) {
  const collection = createCollection(
    rxdbCollectionOptions<MemoDocument>({
      rxCollection: rxdb.memos,
      startSync: true, // Start syncing immediately
    }),
  );

  return collection;
}

/**
 * Type for the memos collection
 */
export type MemosCollection = ReturnType<typeof createMemosCollection>;
