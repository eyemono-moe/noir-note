import type { RxCollection, RxDatabase, RxJsonSchema } from "rxdb";
import { createRxDatabase } from "rxdb";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";

/**
 * Memo document type
 */
export interface MemoDocument {
  path: string; // Primary key
  content: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * RxDB Schema for Memo collection
 */
const memoSchema: RxJsonSchema<MemoDocument> = {
  version: 0,
  primaryKey: "path",
  type: "object",
  properties: {
    path: {
      type: "string",
      maxLength: 500,
    },
    content: {
      type: "string",
    },
    createdAt: {
      type: "number",
      minimum: 0,
      maximum: 10000000000000,
      multipleOf: 1,
    },
    updatedAt: {
      type: "number",
      minimum: 0,
      maximum: 10000000000000,
      multipleOf: 1,
    },
  },
  required: ["path", "content", "createdAt", "updatedAt"],
  indexes: ["updatedAt"], // Index for sorting by update time
};

/**
 * Database collections
 */
export interface NoirNotesCollections {
  memos: RxCollection<MemoDocument>;
}

/**
 * Database type
 */
export type NoirNotesDatabase = RxDatabase<NoirNotesCollections>;

/**
 * Create and initialize RxDB database
 */
export async function createNoirNotesDB(): Promise<NoirNotesDatabase> {
  console.log("[RxDB] Creating database...");

  const db = await createRxDatabase<NoirNotesCollections>({
    name: "noir_notes",
    storage: getRxStorageDexie(),
    multiInstance: true, // Support multiple tabs
    eventReduce: true, // Enable event reduce for better query performance
  });

  console.log("[RxDB] Database created, adding collections...");

  // Add memos collection
  await db.addCollections({
    memos: {
      schema: memoSchema,
    },
  });

  console.log("[RxDB] Collections added successfully");

  return db;
}
