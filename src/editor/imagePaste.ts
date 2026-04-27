/**
 * CodeMirror extension that intercepts paste and drop events containing image
 * files, saves them to OPFS via `imageStore`, and inserts a markdown image
 * reference at the cursor / drop position.
 */

import { EditorView } from "@codemirror/view";

import { saveImage } from "../db/imageStore";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

function buildMarkdown(id: string, originalName: string): string {
  // Use the original filename (without extension) as alt text.
  const alt = originalName.replace(/\.[^.]+$/, "");
  return `![${alt}](attachment://${id})`;
}

async function insertImages(files: File[], view: EditorView, pos: number): Promise<void> {
  const markdowns = await Promise.all(
    files.map(async (file) => {
      const id = await saveImage(file);
      return buildMarkdown(id, file.name);
    }),
  );

  const insertion = markdowns.join("\n");
  view.dispatch({
    changes: { from: pos, insert: insertion },
    selection: { anchor: pos + insertion.length },
  });
  view.focus();
}

// ---------------------------------------------------------------------------
// CodeMirror extension
// ---------------------------------------------------------------------------

export const imagePasteExtension = EditorView.domEventHandlers({
  /**
   * Intercept paste events that contain image data.
   * Text paste is left to CodeMirror's default handler.
   */
  paste(event, view) {
    const items = event.clipboardData?.items;
    if (!items) return false;

    const imageFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length === 0) return false;

    event.preventDefault();
    const pos = view.state.selection.main.from;
    void insertImages(imageFiles, view, pos);
    return true;
  },

  /**
   * Intercept drop events that contain image files.
   * Non-image drops are left to CodeMirror's default handler.
   */
  drop(event, view) {
    const files = event.dataTransfer?.files;
    if (!files?.length) return false;

    const imageFiles = Array.from(files).filter(isImageFile);
    if (imageFiles.length === 0) return false;

    event.preventDefault();

    // Resolve the document position at the drop coordinates.
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.doc.length;
    void insertImages(imageFiles, view, pos);
    return true;
  },

  /**
   * Allow drops by preventing the default dragover behaviour.
   * Without this the browser would refuse the drop entirely.
   */
  dragover(event) {
    const hasImage = Array.from(event.dataTransfer?.items ?? []).some(
      (item) => item.kind === "file" && item.type.startsWith("image/"),
    );
    if (hasImage) {
      event.preventDefault();
    }
    return hasImage;
  },
});
