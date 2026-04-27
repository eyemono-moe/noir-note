import { deleteOrphanedImages, listImages } from "../../db/imageStore";
import { queryAllMemoContents } from "../../db/rxdb";
import { openAttachmentManager } from "../../store/attachmentManagerStore";
import type { Command } from "../types";

/** Regex that matches every `attachment://` reference inside a markdown string. */
const ATTACHMENT_REF_RE = /attachment:\/\/([^\s)"']+)/g;

/**
 * Collect all attachment IDs that are currently referenced in any note.
 */
async function collectReferencedIds(): Promise<Set<string>> {
  const contents = await queryAllMemoContents();
  const ids = new Set<string>();
  for (const content of contents) {
    for (const match of content.matchAll(ATTACHMENT_REF_RE)) {
      ids.add(match[1]);
    }
  }
  return ids;
}

const cleanupUnusedAttachmentsCommand: Command = {
  id: "cleanup-unused-attachments",
  label: "Attachments: Clean Up Unused",
  description: "Delete attachment images that are no longer referenced by any note",
  category: "attachments",
  execute: async () => {
    const [referencedIds, allImages] = await Promise.all([collectReferencedIds(), listImages()]);

    const orphanCount = allImages.filter(({ id }) => !referencedIds.has(id)).length;
    if (orphanCount === 0) {
      // Nothing to clean up — surface this to the user via the console for now;
      // a toast/notification layer can replace this in a future iteration.
      console.info("[attachments] No unused attachments found.");
      return;
    }

    const deleted = await deleteOrphanedImages(referencedIds);
    console.info(`[attachments] Deleted ${deleted.length} unused attachment(s):`, deleted);
  },
};

const openAttachmentManagerCommand: Command = {
  id: "open-attachment-manager",
  label: "Attachments: Open Manager",
  description: "View and manage all attachment images stored in this app",
  category: "attachments",
  execute: () => {
    openAttachmentManager();
  },
};

export const attachmentCommands: Command[] = [
  openAttachmentManagerCommand,
  cleanupUnusedAttachmentsCommand,
];
