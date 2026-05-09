import { attachmentsCollection } from "../db/attachmentCollection";
import {
  listImages,
  readAttachmentFile,
  writeAttachmentFile,
  type ImageMeta,
} from "../db/imageStore";
import { memosCollection } from "../db/memoCollection";
import { noteStore, type MemoDocument } from "../db/noteStore";
import { showToast, updateToast } from "../store/toastStore";
import {
  buildExportBundle,
  bytesFromBlob,
  bytesToFile,
  createImportPlan,
  parseExportBundle,
  type ImportConflictMode,
  type ImportPlan,
} from "./bundle";

interface ImportBackupResult {
  plan: ImportPlan;
  noteCount: number;
  attachmentCount: number;
}

async function collectExportAttachments(metas: ImageMeta[]) {
  const attachments = [];
  for (const meta of metas) {
    const file = await readAttachmentFile(meta.id);
    if (!file) continue;
    attachments.push({ meta, data: await bytesFromBlob(file) });
  }
  return attachments;
}

async function createBackupBundle(): Promise<Uint8Array> {
  const [notes, attachmentMetas] = await Promise.all([noteStore.list(), listImages()]);
  const attachments = await collectExportAttachments(attachmentMetas);
  return buildExportBundle({ notes, attachments });
}

function insertOrUpdateNote(note: MemoDocument, existingPaths: Set<string>): void {
  if (existingPaths.has(note.path)) {
    memosCollection.update(note.path, (draft) => {
      draft.content = note.content;
      draft.createdAt = note.createdAt;
      draft.updatedAt = note.updatedAt;
      draft.metadata = note.metadata;
    });
  } else {
    memosCollection.insert(note);
    existingPaths.add(note.path);
  }
}

async function writePlannedAttachments(plan: ImportPlan, existingIds: Set<string>): Promise<void> {
  for (const attachment of plan.attachmentsToWrite) {
    const file = bytesToFile(
      attachment.data,
      attachment.meta.id,
      attachment.meta.mimeType,
      attachment.meta.lastModified,
    );
    await writeAttachmentFile(attachment.meta.id, file);
    if (!existingIds.has(attachment.meta.id)) {
      attachmentsCollection.insert(attachment.meta);
      existingIds.add(attachment.meta.id);
    }
  }
}

async function importBackupBundle(
  bundleBytes: Uint8Array,
  conflictMode: ImportConflictMode = "skip",
): Promise<ImportBackupResult> {
  const parsed = parseExportBundle(bundleBytes);
  const [existingNotes, existingAttachments] = await Promise.all([noteStore.list(), listImages()]);
  const existingPaths = new Set(existingNotes.map((note) => note.path));
  const existingAttachmentIds = new Set(existingAttachments.map((attachment) => attachment.id));
  const plan = createImportPlan(parsed, { existingNotes, existingAttachments, conflictMode });

  await writePlannedAttachments(plan, existingAttachmentIds);
  for (const note of plan.notesToUpdate) insertOrUpdateNote(note, existingPaths);
  for (const note of plan.notesToInsert) insertOrUpdateNote(note, existingPaths);

  return {
    plan,
    noteCount: plan.notesToInsert.length + plan.notesToUpdate.length,
    attachmentCount: plan.attachmentsToWrite.length,
  };
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function saveBundleToFile(bundle: Uint8Array): Promise<void> {
  const filename = `eyemono-md-export-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
  const blob = new Blob([bundle as BlobPart], { type: "application/zip" });
  if ("showSaveFilePicker" in window) {
    const showSaveFilePicker = window.showSaveFilePicker as (options: {
      suggestedName: string;
      types: Array<{ description: string; accept: Record<string, string[]> }>;
    }) => Promise<{ createWritable: () => Promise<FileSystemWritableFileStream> }>;
    const handle = await showSaveFilePicker({
      suggestedName: filename,
      types: [{ description: "eyemono.md backup", accept: { "application/zip": [".zip"] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }
  downloadBlob(blob, filename);
}

function readFileFromInput(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".zip,application/zip";
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

function chooseConflictMode(): ImportConflictMode | null {
  const input = window.prompt("Import conflict mode: skip, overwrite, or rename", "skip");
  if (input === null) return null;
  if (input === "skip" || input === "overwrite" || input === "rename") return input;
  window.alert("Invalid import conflict mode. Use skip, overwrite, or rename.");
  return null;
}

export async function exportBackupWithToast(): Promise<void> {
  const toastId = showToast({ type: "loading", title: "Exporting notes…" });
  try {
    const bundle = await createBackupBundle();
    await saveBundleToFile(bundle);
    updateToast(toastId, { type: "success", title: "Exported notes backup" });
  } catch (error) {
    updateToast(toastId, {
      type: "error",
      title: "Failed to export backup",
      description: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function importBackupWithToast(): Promise<void> {
  const file = await readFileFromInput();
  if (!file) return;
  const conflictMode = chooseConflictMode();
  if (!conflictMode) return;

  const toastId = showToast({ type: "loading", title: "Importing notes…" });
  try {
    const result = await importBackupBundle(await bytesFromBlob(file), conflictMode);
    updateToast(toastId, {
      type: "success",
      title: `Imported ${result.noteCount} notes and ${result.attachmentCount} attachments`,
      description:
        result.plan.notesToSkip.length > 0
          ? `Skipped ${result.plan.notesToSkip.length} existing notes.`
          : undefined,
    });
  } catch (error) {
    updateToast(toastId, {
      type: "error",
      title: "Failed to import backup",
      description: error instanceof Error ? error.message : String(error),
    });
  }
}
