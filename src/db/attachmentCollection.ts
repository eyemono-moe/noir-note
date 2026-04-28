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
import type { DeleteMutationFnParams, InsertMutationFnParams } from "@tanstack/solid-db";

import { deleteImage, listImages, saveImage, type ImageMeta } from "./imageStore";
import { createOpfsBroadcastSync } from "./opfsSync";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Attachment metadata stored in the TanStack DB collection. */
export type AttachmentMeta = ImageMeta;

const BROADCAST_CHANNEL_ID = "eyemono-attachments";

// ---------------------------------------------------------------------------
// Collection options creator
// OPFS の読み書きは onInsert / onDelete ハンドラが直接担当し、呼び出し側には
// addAttachment / removeAttachment だけを公開する設計。
// ref: https://tanstack.com/db/latest/docs/guides/collection-options-creator
// ---------------------------------------------------------------------------

function opfsAttachmentCollectionOptions() {
  return {
    id: "attachments",
    getKey: (item: AttachmentMeta) => item.id,
    startSync: true,
    sync: {
      sync: createOpfsBroadcastSync<AttachmentMeta, string>(BROADCAST_CHANNEL_ID, listImages),
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
        channel.postMessage({ type: "insert", value: modified });
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
        channel.postMessage({ type: "delete", key: id });
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
export const attachmentsCollection = createCollection(opfsAttachmentCollectionOptions());

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
