/**
 * TanStack DB collection for notes, backed by OPFS file storage.
 *
 * Architecture:
 *   - OPFS/notes/{base64url(path)}.json stores one MemoDocument per note
 *   - On startup, the sync function enumerates OPFS to populate the collection
 *   - Mutations are persisted to OPFS via onInsert / onUpdate / onDelete
 *   - Cross-tab sync is handled via BroadcastChannel
 *
 * Public API (callers do not need to know about OPFS directly):
 *   memosCollection      — TanStack DB collection for useLiveQuery
 *   addMemo(doc)         — insert a new note
 *   updateMemo(path, fn) — update an existing note
 *   removeMemo(path)     — delete a note
 *
 * The welcome note is inserted the first time the collection is ready and
 * the OPFS directory is empty.
 */

import { createCollection } from "@tanstack/solid-db";
import type {
  DeleteMutationFnParams,
  InsertMutationFnParams,
  UpdateMutationFnParams,
} from "@tanstack/solid-db";

import { migrateNotesFromRxDB } from "./migration";
import { encodeNoteId, noteStore, type MemoDocument } from "./noteStore";
import { createOpfsBroadcastSync } from "./opfsSync";

export type { MemoDocument };

const BROADCAST_CHANNEL_ID = "eyemono-memos";

// ---------------------------------------------------------------------------
// Default welcome note
// ---------------------------------------------------------------------------

const WELCOME_PATH = "/";
const WELCOME_CONTENT = `# Welcome to eyemono.md

A markdown note-taking app that runs entirely in your browser.
All notes are stored locally using the Origin Private File System (OPFS).

## Keyboard Shortcuts

- \`Cmd/Ctrl + K\` - Command palette
- \`Cmd/Ctrl + S\` or \`Cmd/Ctrl + Shift + F\` - Format note

## Path-Based Navigation

Each note has a unique path corresponding to the URL.
You can link notes using relative paths like [this](./child-note).

## About

This app is under active development.

- Repository: [github.com/eyemono-moe/noir-note](https://github.com/eyemono-moe/noir-note)
- Contact: eyemono.moe@gmail.com
`;

// ---------------------------------------------------------------------------
// Collection options
// ---------------------------------------------------------------------------

function opfsMemosCollectionOptions() {
  return {
    id: "memos",
    getKey: (item: MemoDocument) => item.path,
    startSync: true,
    sync: {
      sync: createOpfsBroadcastSync<MemoDocument, string>(BROADCAST_CHANNEL_ID, async () => {
        // Run the one-time migration from the old RxDB/IndexedDB store.
        // This is a no-op once the migration flag is set in localStorage.
        await migrateNotesFromRxDB();

        const docs = await noteStore.list();

        // First-run: seed the welcome note when OPFS is empty.
        if (docs.length === 0) {
          const now = Date.now();
          const welcome: MemoDocument = {
            path: WELCOME_PATH,
            content: WELCOME_CONTENT,
            createdAt: now,
            updatedAt: now,
          };
          await noteStore.write(welcome);
          return [welcome];
        }

        return docs;
      }),
      rowUpdateMode: "full" as const,
    },

    /** Persist new note to OPFS and broadcast to other tabs. */
    onInsert: async (params: InsertMutationFnParams<MemoDocument, string>) => {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_ID);
      for (const { modified } of params.transaction.mutations) {
        await noteStore.write(modified);
        channel.postMessage({ type: "insert", value: modified });
      }
      channel.close();
    },

    /** Persist updated note to OPFS and broadcast to other tabs. */
    onUpdate: async (params: UpdateMutationFnParams<MemoDocument, string>) => {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_ID);
      for (const { modified } of params.transaction.mutations) {
        await noteStore.write(modified);
        channel.postMessage({ type: "insert", value: modified });
      }
      channel.close();
    },

    /** Remove note file from OPFS and broadcast to other tabs. */
    onDelete: async (params: DeleteMutationFnParams<MemoDocument, string>) => {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_ID);
      for (const { key } of params.transaction.mutations) {
        const noteId = encodeNoteId(key as string);
        await noteStore.delete(noteId);
        channel.postMessage({ type: "delete", key });
      }
      channel.close();
    },
  };
}

// ---------------------------------------------------------------------------
// Module-level singleton
// ---------------------------------------------------------------------------

/**
 * The TanStack DB collection for notes.
 * Use with `useLiveQuery(() => memosCollection)` to get a reactive list.
 */
export const memosCollection = createCollection(opfsMemosCollectionOptions());

/** Type of the TanStack DB memos collection (used by Sidebar components). */
export type MemosCollection = typeof memosCollection;

// ---------------------------------------------------------------------------
// Imperative query helpers
// Used for operations that run outside of a reactive SolidJS context
// (e.g. the "clean up unused attachments" command).
// ---------------------------------------------------------------------------

const ATTACHMENT_REF_RE = /attachment:\/\/([^\s)"']+)/g;

/**
 * One-shot query that returns the `content` field of every memo.
 * Safe to call outside a reactive context.
 */
export async function queryAllMemoContents(): Promise<string[]> {
  const docs = await noteStore.list();
  return docs.map((doc) => doc.content);
}

/**
 * One-shot query that returns the paths of every memo that references the
 * given attachment ID at least once.
 * Safe to call outside a reactive context.
 */
export async function queryMemoPathsReferencingAttachment(attachmentId: string): Promise<string[]> {
  const docs = await noteStore.list();
  const paths: string[] = [];
  for (const doc of docs) {
    for (const match of doc.content.matchAll(ATTACHMENT_REF_RE)) {
      if (match[1] === attachmentId) {
        paths.push(doc.path);
        break; // count each note at most once
      }
    }
  }
  return paths;
}
