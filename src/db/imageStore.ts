/**
 * OPFS-based image attachment store.
 *
 * All attachments are stored as files in a flat `attachments/` directory inside
 * the Origin Private File System.  Each file is named `{uuid}-{sanitized-original-name}`
 * so that:
 *   - uniqueness is guaranteed by the UUID prefix
 *   - the original filename stays human-readable
 *
 * Markdown references use the `attachment://` scheme:
 *   ![alt](attachment://550e8400-...-screenshot.png)
 */

const ATTACHMENTS_DIR = "attachments";

// ---------------------------------------------------------------------------
// Thumbnail URL cache
//
// Object URLs for 72×72 thumbnails are stored here for the lifetime of the
// page.  Virtual-list rows mount and unmount as the user scrolls; without this
// cache every remount would re-read OPFS and re-decode the image.
//
// Entries are evicted only when the attachment is deleted (deleteImage).
// ---------------------------------------------------------------------------

/** Thumbnail side length (pixels, 2× for HiDPI). */
const THUMB_PX = 72;

/** id → object URL of the downsampled thumbnail blob. */
const thumbnailCache = new Map<string, string>();

export interface ImageMeta {
  id: string;
  size: number;
  mimeType: string;
  lastModified: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function getAttachmentsDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(ATTACHMENTS_DIR, { create: true });
}

/**
 * Sanitize a filename so it is safe to use as an OPFS entry name.
 * Keeps alphanumerics, dots, hyphens and underscores; replaces anything else
 * with a hyphen.  Truncates to 100 characters.
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-{2,}/g, "-")
    .slice(0, 100);
}

/**
 * Generate a timestamped fallback name for files without a meaningful name
 * (e.g. screenshots pasted from the clipboard arrive as "image.png").
 */
function buildScreenshotName(mimeType: string): string {
  const ext = mimeType.split("/")[1] ?? "png";
  const now = new Date();
  const ts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  return `screenshot-${ts}.${ext}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Save an image File to OPFS.
 * Returns the attachment ID (= the OPFS filename) to be embedded in markdown.
 */
export async function saveImage(file: File): Promise<string> {
  // Use a generic screenshot name when the file has a generic name like "image.png"
  const isGenericName = /^image\.(png|jpe?g|gif|webp|bmp)$/i.test(file.name);
  const baseName = isGenericName ? buildScreenshotName(file.type) : sanitizeFilename(file.name);
  const id = `${crypto.randomUUID()}-${baseName}`;
  await writeAttachmentFile(id, file);
  return id;
}

/**
 * Write attachment bytes using a known attachment ID.
 * Used by import/restore flows where markdown references already point at IDs.
 */
export async function writeAttachmentFile(id: string, blob: Blob): Promise<void> {
  const dir = await getAttachmentsDir();
  const fileHandle = await dir.getFileHandle(id, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(blob);
  } finally {
    await writable.close();
  }
}

/** Read an attachment file from OPFS for backup/export. */
export async function readAttachmentFile(id: string): Promise<File | null> {
  try {
    const dir = await getAttachmentsDir();
    const fileHandle = await dir.getFileHandle(id);
    return fileHandle.getFile();
  } catch {
    return null;
  }
}

/**
 * Create a temporary object URL for displaying an attachment in the preview.
 * The caller is responsible for revoking the URL via `URL.revokeObjectURL()`
 * when it is no longer needed.
 *
 * Returns `null` when the attachment does not exist (broken reference).
 */
export async function getImageUrl(id: string): Promise<string | null> {
  try {
    const dir = await getAttachmentsDir();
    const fileHandle = await dir.getFileHandle(id);
    const file = await fileHandle.getFile();
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
}

/**
 * Return a cached object URL for a downsampled thumbnail (THUMB_PX × THUMB_PX, WebP).
 *
 * On the first call for a given `id`:
 *   1. Reads the file from OPFS.
 *   2. Decodes + resizes it asynchronously via `createImageBitmap` (no main-thread decode).
 *   3. Draws into an `OffscreenCanvas` and encodes as a compact WebP blob.
 *   4. Creates an object URL and stores it in `thumbnailCache`.
 *
 * Subsequent calls return the cached URL immediately (zero OPFS I/O).
 * The cache entry is evicted when the attachment is deleted (`deleteImage`).
 *
 * Returns `null` for missing or non-image files.
 */
export async function getThumbnailUrl(id: string): Promise<string | null> {
  const cached = thumbnailCache.get(id);
  if (cached !== undefined) return cached;

  try {
    const dir = await getAttachmentsDir();
    const handle = await dir.getFileHandle(id);
    const file = await handle.getFile();

    // createImageBitmap with resize options decodes on a background thread.
    const bitmap = await createImageBitmap(file, {
      resizeWidth: THUMB_PX,
      resizeHeight: THUMB_PX,
      resizeQuality: "medium",
    });

    const canvas = new OffscreenCanvas(THUMB_PX, THUMB_PX);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
    bitmap.close();

    const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.8 });
    const url = URL.createObjectURL(blob);
    thumbnailCache.set(id, url);
    return url;
  } catch {
    return null;
  }
}

/**
 * Delete a single attachment by ID.
 * Also evicts its thumbnail from the module-level cache.
 * Silently ignores missing files.
 */
export async function deleteImage(id: string): Promise<void> {
  const cachedUrl = thumbnailCache.get(id);
  if (cachedUrl !== undefined) {
    URL.revokeObjectURL(cachedUrl);
    thumbnailCache.delete(id);
  }

  try {
    const dir = await getAttachmentsDir();
    await dir.removeEntry(id);
  } catch {
    // File already gone — nothing to do.
  }
}

/**
 * List all stored attachments with basic metadata.
 */
export async function listImages(): Promise<ImageMeta[]> {
  const dir = await getAttachmentsDir();
  const results: ImageMeta[] = [];

  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === "file") {
      const file = await handle.getFile();
      results.push({
        id: name,
        size: file.size,
        mimeType: file.type,
        lastModified: file.lastModified,
      });
    }
  }

  return results;
}

/**
 * Browser storage quota information (total quota + bytes used by this origin).
 */
export async function getStorageEstimate(): Promise<StorageEstimate> {
  return navigator.storage.estimate();
}
