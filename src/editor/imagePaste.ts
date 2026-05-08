/**
 * CodeMirror extension that intercepts paste and drop events containing image
 * files, saves them to OPFS via `imageStore`, and inserts a markdown image
 * reference at the cursor / drop position.
 */

import { EditorView } from "@codemirror/view";

import { addAttachment } from "../db/attachmentCollection";
import { showToast, updateToast } from "../store/toastStore";

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

function imageLabel(count: number): string {
  return count === 1 ? "image" : "images";
}

function getErrorMessage(reason: unknown): string {
  if (reason instanceof Error && reason.message) return reason.message;
  if (typeof reason === "string" && reason) return reason;
  return "Unknown error";
}

type ImageInsertionDispatchSpec = {
  changes: { from: number; insert: string };
  selection: { anchor: number };
};

type ImageInsertionView = {
  dispatch: (spec: ImageInsertionDispatchSpec) => void;
  focus: () => void;
};

type ImageInsertionDependencies = {
  addAttachment: (file: File) => Promise<string>;
  showToast: typeof showToast;
  updateToast: typeof updateToast;
};

const defaultDependencies: ImageInsertionDependencies = {
  addAttachment,
  showToast,
  updateToast,
};

export async function insertImages(
  files: File[],
  view: ImageInsertionView,
  pos: number,
  dependencies: ImageInsertionDependencies = defaultDependencies,
): Promise<void> {
  const total = files.length;
  const toastId = dependencies.showToast({
    type: "loading",
    title: `Saving ${total} ${imageLabel(total)}…`,
  });

  const results = await Promise.allSettled(
    files.map(async (file) => {
      const id = await dependencies.addAttachment(file);
      return buildMarkdown(id, file.name);
    }),
  );

  const markdowns = results
    .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled")
    .map((result) => result.value);
  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );

  if (markdowns.length > 0) {
    const insertion = markdowns.join("\n");
    view.dispatch({
      changes: { from: pos, insert: insertion },
      selection: { anchor: pos + insertion.length },
    });
    view.focus();
  }

  if (failures.length === 0) {
    dependencies.updateToast(toastId, {
      type: "success",
      title: `Inserted ${total} ${imageLabel(total)}`,
      duration: 3000,
    });
    return;
  }

  const firstErrorMessage = getErrorMessage(failures[0]?.reason);
  const description =
    markdowns.length === 0
      ? firstErrorMessage
      : `Failed to save ${failures.length} ${imageLabel(failures.length)}: ${firstErrorMessage}`;

  dependencies.updateToast(toastId, {
    type: "error",
    title:
      markdowns.length === 0
        ? `Failed to insert ${imageLabel(total)}`
        : `Inserted ${markdowns.length} of ${total} ${imageLabel(total)}`,
    description,
    duration: 6000,
  });
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
