import { attachmentsCollection, cleanupOrphanedAttachments } from "../../db/attachmentCollection";
import { queryAllMemoContents } from "../../db/memoCollection";
import { updateSidebarTab } from "../../store/configStore";
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

const openAttachmentsTabCommand: Command = {
  id: "open-attachment-manager",
  label: "Attachments: Open Manager",
  description: "Switch to the Attachments tab in the sidebar",
  category: "attachments",
  execute: () => {
    updateSidebarTab("attachments");
  },
};

const cleanupUnusedAttachmentsCommand: Command = {
  id: "cleanup-unused-attachments",
  label: "Attachments: Clean Up Unused",
  description: "Delete attachment images that are no longer referenced by any note",
  category: "attachments",
  execute: async () => {
    const referencedIds = await collectReferencedIds();

    // Use the collection for a quick count check if it's ready
    const total = attachmentsCollection.isReady()
      ? attachmentsCollection.size
      : Number.POSITIVE_INFINITY;
    if (total === 0) {
      console.info("[attachments] No attachments found.");
      return;
    }

    const deleted = await cleanupOrphanedAttachments(referencedIds);
    if (deleted.length === 0) {
      console.info("[attachments] No unused attachments found.");
    } else {
      console.info(`[attachments] Deleted ${deleted.length} unused attachment(s):`, deleted);
    }
  },
};

export const attachmentCommands: Command[] = [
  openAttachmentsTabCommand,
  cleanupUnusedAttachmentsCommand,
];
