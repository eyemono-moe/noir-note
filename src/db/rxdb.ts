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

// Module-level singleton — set once after `createNoirNotesDB` resolves.
// Exposed only for imperative / non-reactive operations (e.g. the
// cleanup-unused-attachments command).  Reactive UI should always use the
// TanStack DB collection via `useMemosCollection()` instead.
let _db: NoirNotesDatabase | null = null;

/**
 * One-shot query that returns the `content` field of every memo.
 * Safe to call outside a reactive context (does not require SolidJS owner).
 * Returns an empty array if the database has not been initialized yet.
 */
export async function queryAllMemoContents(): Promise<string[]> {
  if (!_db) return [];
  const docs = await _db.memos.find().exec();
  return docs.map((doc) => doc.content);
}

/**
 * Create and initialize RxDB database
 */
export async function createNoirNotesDB(): Promise<NoirNotesDatabase> {
  const db = await createRxDatabase<NoirNotesCollections>({
    name: "noir_notes",
    storage: getRxStorageDexie(),
    multiInstance: true, // Support multiple tabs
    eventReduce: true, // Enable event reduce for better query performance
  });

  // Add memos collection
  await db.addCollections({
    memos: {
      schema: memoSchema,
      migrationStrategies,
    },
  });

  // insert default document if collection is empty (for easier testing and development)
  const memosCollection = db.memos;
  const count = await memosCollection.count().exec();
  if (count === 0) {
    const now = Date.now();
    await memosCollection.insert({
      path: "/",
      content: `# Welcome to eyemono.md

A markdown note-taking app that runs entirely in your browser. All notes are stored locally using IndexedDB.

## Keyboard Shortcuts

- \`Cmd/Ctrl + K\` - Command palette
- \`Cmd/Ctrl + S\` or \`Cmd/Ctrl + Shift + F\` - Format note

## Path-Based Navigation

Each note has a unique path corresponding to the URL. You can link notes using relative paths like [this](./child-note).

## About

This app is under active development.

- Repository: [github.com/eyemono-moe/noir-note](https://github.com/eyemono-moe/noir-note)
- Contact: eyemono.moe@gmail.com
`,
      createdAt: now,
      updatedAt: now,
    });
  }

  _db = db;
  return db;
}
