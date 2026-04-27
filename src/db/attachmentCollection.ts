/**
 * TanStack DB collection for attachment metadata, backed by OPFS file storage.
 *
 * Architecture:
 *   - OPFS holds the raw file bytes (source of truth for binary data)
 *   - This collection holds metadata only: { id, size, mimeType, lastModified }
 *   - On startup, `sync.sync` enumerates OPFS to populate the collection
 *   - Mutations are persisted to OPFS via `onInsert`/`onDelete` handlers
 *   - Cross-tab sync is handled via BroadcastChannel
 *
 * Public API (callers do not need to know about OPFS directly):
 *   addAttachment(file)         — save to OPFS + register in collection
 *   removeAttachment(id)        — delete from OPFS + unregister from collection
 *   cleanupOrphanedAttachments  — bulk-remove attachments not referenced by any note
 *   attachmentsCollection       — TanStack DB collection for useLiveQuery
 */

import { createCollection } from "@tanstack/solid-db";
import type {
  ChangeMessageOrDeleteKeyMessage,
  Collection,
  DeleteMutationFnParams,
  InsertMutationFnParams,
  NonSingleResult,
  SyncConfig,
} from "@tanstack/solid-db";

import { deleteImage, listImages, saveImage, type ImageMeta } from "./imageStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Attachment metadata stored in the TanStack DB collection. */
export type AttachmentMeta = ImageMeta;

type AttachmentMsg = ChangeMessageOrDeleteKeyMessage<AttachmentMeta, string>;

const BROADCAST_CHANNEL_ID = "eyemono-attachments";

// ---------------------------------------------------------------------------
// Collection options creator (Pattern B — built-in handlers)
// ---------------------------------------------------------------------------

function opfsAttachmentCollectionOptions() {
  // ── sync ────────────────────────────────────────────────────────────────
  const sync: SyncConfig<AttachmentMeta, string>["sync"] = ({
    begin,
    write,
    commit,
    markReady,
  }) => {
    let initialSyncComplete = false;
    const eventBuffer: AttachmentMsg[] = [];

    // Start BroadcastChannel listener BEFORE the initial OPFS enumerate so
    // that events arriving during the async enumerate are buffered rather
    // than lost.
    const channel = new BroadcastChannel(BROADCAST_CHANNEL_ID);
    channel.onmessage = (evt: MessageEvent<AttachmentMsg>) => {
      if (!initialSyncComplete) {
        eventBuffer.push(evt.data);
        return;
      }
      begin({ immediate: true });
      write(evt.data);
      commit();
    };

    // Initial state: enumerate every file in OPFS/attachments/
    void (async () => {
      try {
        const files = await listImages();
        begin();
        for (const f of files) {
          write({ type: "insert", value: f });
        }
        commit();

        // Flush events that arrived while the initial fetch was in flight
        initialSyncComplete = true;
        if (eventBuffer.length > 0) {
          begin();
          for (const msg of eventBuffer) write(msg);
          commit();
          eventBuffer.splice(0);
        }
      } catch (err) {
        console.error("[attachments] Initial OPFS sync failed:", err);
        initialSyncComplete = true; // prevent buffer from growing unboundedly
      } finally {
        // Always mark ready so the UI doesn't stay in the loading state
        markReady();
      }
    })();

    return () => channel.close();
  };

  return {
    id: "attachments",
    getKey: (item: AttachmentMeta) => item.id,
    startSync: true,
    sync: {
      sync,
      // Every write carries the full record, not just a delta
      rowUpdateMode: "full" as const,
    },

    /**
     * OPFS bytes are written by `addAttachment` *before* `collection.insert`
     * is called, so this handler only needs to broadcast the new entry to
     * other tabs.
     */
    onInsert: async (params: InsertMutationFnParams<AttachmentMeta, string>) => {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_ID);
      for (const { modified } of params.transaction.mutations) {
        channel.postMessage({ type: "insert", value: modified } satisfies AttachmentMsg);
      }
      channel.close();
    },

    /**
     * Delete the file bytes from OPFS, then broadcast to other tabs.
     * The optimistic removal from the local collection has already happened
     * before this handler fires.
     */
    onDelete: async (params: DeleteMutationFnParams<AttachmentMeta, string>) => {
      const ids = params.transaction.mutations.map((m) => m.key as string);
      await Promise.all(ids.map(deleteImage));
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_ID);
      for (const id of ids) {
        channel.postMessage({ type: "delete", key: id } satisfies AttachmentMsg);
      }
      channel.close();
    },
  };
}

// ---------------------------------------------------------------------------
// Module-level singleton
// ---------------------------------------------------------------------------

/**
 * The TanStack DB collection for attachment metadata.
 * Use with `useLiveQuery(() => attachmentsCollection)` to get a reactive list.
 */
// Double-cast so `useLiveQuery(() => attachmentsCollection)` picks overload 3
// (non-single-result) and infers TResult = AttachmentMeta.
//
// Why: `Collection<T>` declares `singleResult?: true`, which conflicts with
// overload 3's `& NonSingleResult` constraint. Adding `& NonSingleResult`
// (≡ `& { singleResult?: never }`) resolves the ambiguity.
// The `unknown` intermediate step bypasses the overlap check on `true` vs `never`.
export const attachmentsCollection = createCollection(
  opfsAttachmentCollectionOptions(),
) as unknown as Collection<AttachmentMeta, string> & NonSingleResult;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Save a File to OPFS and register it in the attachments collection.
 * Returns the attachment ID (`{uuid}-{filename}`) to embed in markdown:
 * `![alt](attachment://{id})`
 */
export async function addAttachment(file: File): Promise<string> {
  const id = await saveImage(file);
  attachmentsCollection.insert({
    id,
    size: file.size,
    mimeType: file.type,
    lastModified: Date.now(),
  });
  return id;
}

/**
 * Remove an attachment from both the collection and OPFS.
 * The UI updates optimistically; the OPFS delete runs via `onDelete`.
 */
export function removeAttachment(id: string): void {
  attachmentsCollection.delete(id);
}

/**
 * Delete every attachment whose ID is not in `referencedIds`.
 * Uses OPFS as the ground truth for enumeration so crash-orphaned files
 * (in OPFS but missing from the collection) are also cleaned up.
 * Returns the list of deleted IDs.
 */
export async function cleanupOrphanedAttachments(referencedIds: Set<string>): Promise<string[]> {
  const all = await listImages();
  const orphans = all.filter((a) => !referencedIds.has(a.id));
  for (const { id } of orphans) {
    removeAttachment(id);
  }
  return orphans.map((a) => a.id);
}
