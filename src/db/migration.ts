/**
 * One-time migration: copy notes from the old RxDB/IndexedDB store to OPFS.
 *
 * The migration runs once on startup.  A localStorage flag prevents it from
 * running again.  If it fails (e.g. the old database never existed) the flag
 * is still set so we don't retry on every page load.
 *
 * After the migration this module can be removed once all users have been
 * upgraded; the only remaining reference is the import in memoCollection.ts.
 */

import { noteStore } from "./noteStore";
import type { MemoDocument } from "./noteStore";

const MIGRATION_KEY = "notes-migrated-to-opfs-v1";

/**
 * Migrate notes from the old RxDB IndexedDB store to OPFS.
 * Returns the number of notes migrated (0 = nothing to migrate or already done).
 *
 * Must be called before the TanStack DB collection does its initial enumerate
 * so that migrated notes are picked up in the same startup pass.
 */
export async function migrateNotesFromRxDB(): Promise<number> {
  if (localStorage.getItem(MIGRATION_KEY)) return 0;

  let migrated = 0;

  try {
    // Dynamically import RxDB to avoid bundling it for users who don't need it.
    const { createRxDatabase, addRxPlugin } = await import("rxdb");
    const { getRxStorageDexie } = await import("rxdb/plugins/storage-dexie");
    const { RxDBMigrationSchemaPlugin } = await import("rxdb/plugins/migration-schema");

    addRxPlugin(RxDBMigrationSchemaPlugin);

    // Open the old database with a minimal schema — we only need to read.
    const db = await createRxDatabase({
      name: "noir_notes",
      storage: getRxStorageDexie(),
      multiInstance: false, // migration runs in one tab at a time
    });

    // The schema version must match what was last written.  Version 1 is the
    // current schema in the old rxdb.ts, so no migration strategy is needed
    // here (we're only reading the data, not upgrading it).
    await db.addCollections({
      memos: {
        schema: {
          version: 1,
          primaryKey: "path",
          type: "object",
          properties: {
            path: { type: "string", maxLength: 500 },
            content: { type: "string" },
            createdAt: {
              type: "number",
              minimum: 0,
              maximum: 10_000_000_000_000,
              multipleOf: 1,
            },
            updatedAt: {
              type: "number",
              minimum: 0,
              maximum: 10_000_000_000_000,
              multipleOf: 1,
            },
            metadata: {
              type: "object",
              properties: {
                tags: { type: "array", items: { type: "string" } },
                title: { type: "string" },
              },
              additionalProperties: true,
            },
          },
          required: ["path", "content", "createdAt", "updatedAt"],
          indexes: ["updatedAt"],
        },
        migrationStrategies: {
          // Strategy to read version 0 docs (created before the metadata field).
          1: (oldDoc: {
            path: string;
            content: string;
            createdAt: number;
            updatedAt: number;
          }): MemoDocument => ({ ...oldDoc, metadata: undefined }),
        },
      },
    });

    const docs = await db.memos.find().exec();

    // Skip the migration if the only document is the stock welcome note.
    // This means the user never created any real notes; let the new collection
    // seed its own welcome note instead of carrying over the stale one.
    const isOnlyDefaultNote =
      docs.length === 1 &&
      docs[0].path === "/" &&
      docs[0].content.trimStart().startsWith("# Welcome to eyemono.md");

    if (!isOnlyDefaultNote) {
      for (const rxDoc of docs) {
        const { path, content, createdAt, updatedAt, metadata } = rxDoc.toJSON() as MemoDocument;
        await noteStore.write({ path, content, createdAt, updatedAt, metadata });
        migrated++;
      }
    }

    // Close the RxDB instance.  The type inferred from createRxDatabase with
    // dynamically-imported generics doesn't always expose destroy() as callable
    // in strict TypeScript, so we cast to any here.
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).destroy();
  } catch (err) {
    // The old database may not exist at all (fresh install) — that's fine.
    console.info("[migration] RxDB→OPFS: skipped or failed:", err);
  }

  localStorage.setItem(MIGRATION_KEY, "1");
  return migrated;
}
