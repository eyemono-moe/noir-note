/**
 * Main-thread bridge for the OPFS note store worker.
 *
 * All OPFS I/O for notes is performed inside a dedicated Web Worker using the
 * synchronous FileSystemSyncAccessHandle API (only available in workers).
 * This module provides a thin Promise-based wrapper so callers never interact
 * with the worker directly.
 *
 * Storage layout:
 *   OPFS/notes/{base64url(path)}.json  — one JSON file per note (MemoDocument)
 */

// oxlint-disable-next-line import/default --- needed for Vite worker import
import NoteWorker from "./noteStore.worker?worker";

// ---------------------------------------------------------------------------
// Shared types (also imported by the worker)
// ---------------------------------------------------------------------------

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

/** Encode a note path to a safe OPFS filename (without extension). */
export function encodeNoteId(path: string): string {
  // Encode UTF-8 bytes via TextEncoder → base64url (no padding)
  const bytes = new TextEncoder().encode(path);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ---------------------------------------------------------------------------
// Worker message protocol
// ---------------------------------------------------------------------------

/** Payload variants (without the `id` field, used as the public request API). */
export type WorkerRequestPayload =
  | { type: "list" }
  | { type: "write"; doc: MemoDocument }
  | { type: "delete"; noteId: string }
  | { type: "getSize" };

/** Full request message sent to the worker (payload + correlation id). */
export type WorkerRequest = WorkerRequestPayload & { id: number };

export type WorkerResponse<T = unknown> =
  | { id: number; ok: true; data: T }
  | { id: number; ok: false; error: string };

// ---------------------------------------------------------------------------
// NoteStore class
// ---------------------------------------------------------------------------

class NoteStore {
  private readonly worker: Worker;
  private readonly pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private nextId = 0;

  constructor() {
    this.worker = new NoteWorker();
    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const { id, ok } = e.data;
      const p = this.pending.get(id);
      if (!p) return;
      this.pending.delete(id);
      if (ok) p.resolve(e.data.data);
      else p.reject(new Error((e.data as { ok: false; error: string }).error));
    };
    this.worker.onerror = (e) => {
      console.error("[noteStore] Worker error:", e);
    };
  }

  private request<T>(payload: WorkerRequestPayload): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      // Spread the discriminated-union payload and add the correlation id.
      // The cast is required because TypeScript cannot distribute spreads over
      // unions, but the runtime value is always correct.
      this.worker.postMessage({ ...payload, id } as WorkerRequest);
    });
  }

  /** Return all stored notes (initial load). */
  list(): Promise<MemoDocument[]> {
    return this.request<MemoDocument[]>({ type: "list" });
  }

  /** Persist (insert or overwrite) a note to OPFS. */
  write(doc: MemoDocument): Promise<void> {
    return this.request<void>({ type: "write", doc });
  }

  /**
   * Delete a note from OPFS.
   * @param noteId  The encoded filename key (= encodeNoteId(path))
   */
  delete(noteId: string): Promise<void> {
    return this.request<void>({ type: "delete", noteId });
  }

  /** Sum of all note JSON file sizes in bytes. */
  getSize(): Promise<number> {
    return this.request<number>({ type: "getSize" });
  }
}

// Module-level singleton — one worker shared for the app's lifetime.
export const noteStore = new NoteStore();
