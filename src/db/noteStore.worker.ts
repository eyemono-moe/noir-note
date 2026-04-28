/**
 * OPFS note store worker.
 *
 * Runs in a dedicated Web Worker so it can use FileSystemSyncAccessHandle —
 * a synchronous, lower-latency API for OPFS writes that is only available
 * inside workers (not on the main thread).
 *
 * Handles four operations:
 *   list    — enumerate OPFS/notes/ and return all MemoDocument[]
 *   write   — persist one MemoDocument (create or overwrite)
 *   delete  — remove one note file
 *   getSize — sum all note file sizes in bytes
 */

import type { MemoDocument, WorkerRequest, WorkerResponse } from "./noteStore";

// ---------------------------------------------------------------------------
// FileSystemSyncAccessHandle type augmentation
//
// createSyncAccessHandle() is a worker-only OPFS API.  TypeScript's DOM lib
// targets the main-thread surface and may omit it.  We declare the minimal
// interface here so the worker code type-checks correctly.
// ---------------------------------------------------------------------------

interface FileSystemSyncAccessHandle {
  read(buffer: BufferSource, options?: { at?: number }): number;
  write(buffer: BufferSource, options?: { at?: number }): number;
  flush(): void;
  close(): void;
  truncate(newSize: number): void;
  getSize(): number;
}

declare global {
  interface FileSystemFileHandle {
    createSyncAccessHandle(): Promise<FileSystemSyncAccessHandle>;
  }
}

const NOTES_DIR = "notes";

// ---------------------------------------------------------------------------
// OPFS helpers
// ---------------------------------------------------------------------------

async function getNotesDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(NOTES_DIR, { create: true });
}

/** Encode a note path to a safe OPFS filename (without extension). */
function encodeNoteId(path: string): string {
  const bytes = new TextEncoder().encode(path);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

async function listNotes(): Promise<MemoDocument[]> {
  const dir = await getNotesDir();
  const docs: MemoDocument[] = [];

  for await (const [name, handle] of dir.entries()) {
    if (handle.kind !== "file" || !name.endsWith(".json")) continue;
    try {
      const file = await (handle as FileSystemFileHandle).getFile();
      const text = await file.text();
      docs.push(JSON.parse(text) as MemoDocument);
    } catch {
      // Skip corrupted files silently.
    }
  }

  return docs;
}

async function writeNote(doc: MemoDocument): Promise<void> {
  const dir = await getNotesDir();
  const filename = `${encodeNoteId(doc.path)}.json`;
  const fileHandle = await dir.getFileHandle(filename, { create: true });

  // FileSystemSyncAccessHandle gives us synchronous, atomic-ish writes.
  // It is only available inside Web Workers — that's why this code lives here.
  const syncHandle = await fileHandle.createSyncAccessHandle();
  try {
    const encoded = new TextEncoder().encode(JSON.stringify(doc));
    syncHandle.truncate(0);
    syncHandle.write(encoded, { at: 0 });
    syncHandle.flush();
  } finally {
    // close() must always be called to release the exclusive lock.
    syncHandle.close();
  }
}

async function deleteNote(noteId: string): Promise<void> {
  const dir = await getNotesDir();
  try {
    await dir.removeEntry(`${noteId}.json`);
  } catch {
    // File already gone — nothing to do.
  }
}

async function getNotesSize(): Promise<number> {
  const dir = await getNotesDir();
  let total = 0;

  for await (const [name, handle] of dir.entries()) {
    if (handle.kind !== "file" || !name.endsWith(".json")) continue;
    try {
      const file = await (handle as FileSystemFileHandle).getFile();
      total += file.size;
    } catch {
      // Skip unreadable files.
    }
  }

  return total;
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id } = e.data;

  try {
    switch (e.data.type) {
      case "list": {
        const docs = await listNotes();
        self.postMessage({ id, ok: true, data: docs } satisfies WorkerResponse<MemoDocument[]>);
        break;
      }
      case "write": {
        await writeNote(e.data.doc);
        self.postMessage({ id, ok: true, data: null } satisfies WorkerResponse<null>);
        break;
      }
      case "delete": {
        await deleteNote(e.data.noteId);
        self.postMessage({ id, ok: true, data: null } satisfies WorkerResponse<null>);
        break;
      }
      case "getSize": {
        const size = await getNotesSize();
        self.postMessage({ id, ok: true, data: size } satisfies WorkerResponse<number>);
        break;
      }
    }
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      error: String(err),
    } satisfies WorkerResponse<never>);
  }
};
