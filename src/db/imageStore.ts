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
  const dir = await getAttachmentsDir();

  // Use a generic screenshot name when the file has a generic name like "image.png"
  const isGenericName = /^image\.(png|jpe?g|gif|webp|bmp)$/i.test(file.name);
  const baseName = isGenericName ? buildScreenshotName(file.type) : sanitizeFilename(file.name);

  const id = `${crypto.randomUUID()}-${baseName}`;

  const fileHandle = await dir.getFileHandle(id, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(file);
  } finally {
    await writable.close();
  }

  return id;
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
 * Delete a single attachment by ID.
 * Silently ignores missing files.
 */
export async function deleteImage(id: string): Promise<void> {
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
      const file = await (handle as FileSystemFileHandle).getFile();
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
