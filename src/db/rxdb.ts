import type { RxCollection, RxDatabase, RxJsonSchema } from "rxdb";
import { createRxDatabase, addRxPlugin } from "rxdb";
import { RxDBMigrationSchemaPlugin } from "rxdb/plugins/migration-schema";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";

addRxPlugin(RxDBMigrationSchemaPlugin);

/**
 * Memo document type
 */
export interface MemoDocument {
  path: string; // Primary key
  content: string;
  createdAt: number;
  updatedAt: number;
  metadata?: {
    tags?: string[];
    title?: string;
    [key: string]: unknown;
  };
}

/**
 * RxDB Schema for Memo collection
 */
const memoSchema: RxJsonSchema<MemoDocument> = {
  version: 1,
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
    metadata: {
      type: "object",
      properties: {
        tags: {
          type: "array",
          items: { type: "string" },
        },
        title: { type: "string" },
      },
      additionalProperties: true,
    },
  },
  required: ["path", "content", "createdAt", "updatedAt"],
  indexes: ["updatedAt"], // Index for sorting by update time
};

/**
 * Migration strategies for schema versions
 */
const migrationStrategies = {
  1: function (oldDoc: {
    path: string;
    content: string;
    createdAt: number;
    updatedAt: number;
  }): MemoDocument {
    console.log(`[RxDB Migration] Migrating document: ${oldDoc.path}`);
    return {
      ...oldDoc,
      metadata: undefined,
    };
  },
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
      migrationStrategies,
    },
  });

  console.log("[RxDB] Collections added successfully");

  return db;
}
