import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";

import type { ImageMeta } from "../db/imageStore";
import type { MemoDocument } from "../db/noteStore";

const EXPORT_FORMAT = "eyemono.md.export";
const EXPORT_VERSION = 1;

export type ImportConflictMode = "skip" | "overwrite" | "rename";

interface ExportManifest {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  noteCount: number;
  attachmentCount: number;
}

export interface ExportAttachment {
  meta: ImageMeta;
  data: Uint8Array;
}

interface ParsedExportBundle {
  manifest: ExportManifest;
  notes: MemoDocument[];
  attachments: ExportAttachment[];
}

interface BuildExportBundleInput {
  notes: MemoDocument[];
  attachments: ExportAttachment[];
  exportedAt?: string;
}

interface CreateImportPlanOptions {
  existingNotes: MemoDocument[];
  existingAttachments: ImageMeta[];
  conflictMode: ImportConflictMode;
  now?: number;
}

export interface ImportPlan {
  notesToInsert: MemoDocument[];
  notesToUpdate: MemoDocument[];
  notesToSkip: string[];
  attachmentsToWrite: ExportAttachment[];
  attachmentsToSkip: string[];
  attachmentIdRewrites: Record<string, string>;
}

function jsonToBytes(value: unknown): Uint8Array {
  return strToU8(JSON.stringify(value, null, 2));
}

function bytesToJson<T>(bytes: Uint8Array, filename: string): T {
  try {
    return JSON.parse(strFromU8(bytes)) as T;
  } catch (error) {
    throw new Error(
      `Invalid ${filename}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function validateBundle(parsed: ParsedExportBundle): void {
  if (parsed.manifest.format !== EXPORT_FORMAT || parsed.manifest.version !== EXPORT_VERSION) {
    throw new Error("Unsupported eyemono.md export bundle format");
  }
  if (!Array.isArray(parsed.notes)) throw new Error("Invalid notes.json in export bundle");
  if (!Array.isArray(parsed.attachments))
    throw new Error("Invalid attachments manifest in export bundle");
}

export function buildExportBundle(input: BuildExportBundleInput): Uint8Array {
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const manifest: ExportManifest = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt,
    noteCount: input.notes.length,
    attachmentCount: input.attachments.length,
  };

  const files: Record<string, [Uint8Array, { level: number }]> = {
    "manifest.json": [jsonToBytes(manifest), { level: 6 }],
    "notes.json": [jsonToBytes(input.notes), { level: 6 }],
    "attachments/manifest.json": [
      jsonToBytes(input.attachments.map((attachment) => attachment.meta)),
      { level: 6 },
    ],
  };

  for (const attachment of input.attachments) {
    files[`attachments/${encodeURIComponent(attachment.meta.id)}`] = [
      attachment.data,
      { level: 0 },
    ];
  }

  return zipSync(files as Zippable);
}

export function parseExportBundle(bundle: Uint8Array): ParsedExportBundle {
  const files = unzipSync(bundle);
  const manifestFile = files["manifest.json"];
  const notesFile = files["notes.json"];
  const attachmentsManifestFile = files["attachments/manifest.json"];

  if (!manifestFile || !notesFile || !attachmentsManifestFile) {
    throw new Error(
      `Export bundle is missing manifest.json, notes.json, or attachments/manifest.json. Found: ${Object.keys(files).join(", ")}`,
    );
  }

  const attachmentMetas = bytesToJson<ImageMeta[]>(
    attachmentsManifestFile,
    "attachments/manifest.json",
  );
  const attachments = attachmentMetas.map((meta) => {
    const data = files[`attachments/${encodeURIComponent(meta.id)}`];
    if (!data) throw new Error(`Export bundle is missing attachment data for ${meta.id}`);
    return { meta, data };
  });

  const parsed: ParsedExportBundle = {
    manifest: bytesToJson<ExportManifest>(manifestFile, "manifest.json"),
    notes: bytesToJson<MemoDocument[]>(notesFile, "notes.json"),
    attachments,
  };
  validateBundle(parsed);
  return parsed;
}

function uniqueImportedPath(path: string, used: Set<string>): string {
  const first = `${path} (imported)`;
  if (!used.has(first)) return first;
  for (let index = 2; ; index += 1) {
    const candidate = `${path} (imported ${index})`;
    if (!used.has(candidate)) return candidate;
  }
}

function importedAttachmentId(id: string, used: Set<string>): string {
  const dot = id.lastIndexOf(".");
  const base = dot > 0 ? id.slice(0, dot) : id;
  const ext = dot > 0 ? id.slice(dot) : "";
  const first = `${base}-imported${ext}`;
  if (!used.has(first)) return first;
  for (let index = 2; ; index += 1) {
    const candidate = `${base}-imported-${index}${ext}`;
    if (!used.has(candidate)) return candidate;
  }
}

function rewriteAttachmentReferences(content: string, rewrites: Record<string, string>): string {
  return content.replace(/attachment:\/\/([^\s)"']+)/g, (full, id: string) => {
    const rewritten = rewrites[id];
    return rewritten ? `attachment://${rewritten}` : full;
  });
}

function cloneNoteWithContent(
  note: MemoDocument,
  path: string,
  content: string,
  now: number,
): MemoDocument {
  return {
    ...note,
    path,
    content,
    createdAt: now,
    updatedAt: now,
  };
}

export function createImportPlan(
  bundle: ParsedExportBundle,
  options: CreateImportPlanOptions,
): ImportPlan {
  validateBundle(bundle);

  const now = options.now ?? Date.now();
  const existingNotePaths = new Set(options.existingNotes.map((note) => note.path));
  const usedNotePaths = new Set(existingNotePaths);
  const existingAttachmentById = new Map(
    options.existingAttachments.map((attachment) => [attachment.id, attachment]),
  );
  const usedAttachmentIds = new Set(existingAttachmentById.keys());

  const plan: ImportPlan = {
    notesToInsert: [],
    notesToUpdate: [],
    notesToSkip: [],
    attachmentsToWrite: [],
    attachmentsToSkip: [],
    attachmentIdRewrites: {},
  };

  for (const attachment of bundle.attachments) {
    const existing = existingAttachmentById.get(attachment.meta.id);
    if (!existing) {
      plan.attachmentsToWrite.push(attachment);
      usedAttachmentIds.add(attachment.meta.id);
      continue;
    }

    if (options.conflictMode === "skip") {
      plan.attachmentsToSkip.push(attachment.meta.id);
      continue;
    }

    if (options.conflictMode === "overwrite") {
      plan.attachmentsToWrite.push(attachment);
      continue;
    }

    const renamedId = importedAttachmentId(attachment.meta.id, usedAttachmentIds);
    usedAttachmentIds.add(renamedId);
    plan.attachmentIdRewrites[attachment.meta.id] = renamedId;
    plan.attachmentsToWrite.push({
      ...attachment,
      meta: { ...attachment.meta, id: renamedId },
    });
  }

  for (const note of bundle.notes) {
    const content = rewriteAttachmentReferences(note.content, plan.attachmentIdRewrites);
    const exists = existingNotePaths.has(note.path);

    if (!exists) {
      plan.notesToInsert.push({ ...note, content });
      usedNotePaths.add(note.path);
      continue;
    }

    if (options.conflictMode === "skip") {
      plan.notesToSkip.push(note.path);
      continue;
    }

    if (options.conflictMode === "overwrite") {
      plan.notesToUpdate.push(cloneNoteWithContent(note, note.path, content, now));
      continue;
    }

    const renamedPath = uniqueImportedPath(note.path, usedNotePaths);
    usedNotePaths.add(renamedPath);
    plan.notesToInsert.push(cloneNoteWithContent(note, renamedPath, content, now));
  }

  return plan;
}

export function bytesFromBlob(blob: Blob): Promise<Uint8Array> {
  return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer));
}

export function bytesToFile(
  bytes: Uint8Array,
  name: string,
  type: string,
  lastModified: number,
): File {
  return new File([bytes as BlobPart], name, { type, lastModified });
}
