// @vitest-environment node
import { describe, expect, test } from "vite-plus/test";

import type { ImageMeta } from "../db/imageStore";
import type { MemoDocument } from "../db/noteStore";
import {
  buildExportBundle,
  createImportPlan,
  parseExportBundle,
  type ExportAttachment,
} from "./bundle";

const note = (path: string, content: string): MemoDocument => ({
  path,
  content,
  createdAt: 1,
  updatedAt: 2,
});

const attachment = (id: string, data = "image-bytes"): ExportAttachment => ({
  meta: {
    id,
    size: data.length,
    mimeType: "image/png",
    lastModified: 3,
  },
  data: new TextEncoder().encode(data),
});

const existingAttachment = (id: string, size = 10): ImageMeta => ({
  id,
  size,
  mimeType: "image/png",
  lastModified: 4,
});

describe("export backup bundle", () => {
  test("round-trips notes, metadata, manifest, and attachment bytes in a zip", () => {
    const bundle = buildExportBundle({
      notes: [
        {
          ...note("/daily", "---\ntags: [work]\n---\n![img](attachment://att-1.png)"),
          metadata: { tags: ["work"] },
        },
      ],
      attachments: [attachment("att-1.png")],
      exportedAt: "2026-05-09T00:00:00.000Z",
    });

    const parsed = parseExportBundle(bundle);

    expect(parsed.manifest).toEqual({
      format: "eyemono.md.export",
      version: 1,
      exportedAt: "2026-05-09T00:00:00.000Z",
      noteCount: 1,
      attachmentCount: 1,
    });
    expect(parsed.notes).toHaveLength(1);
    expect(parsed.notes[0]?.metadata).toEqual({ tags: ["work"] });
    expect(parsed.attachments[0]?.meta.id).toBe("att-1.png");
    expect(new TextDecoder().decode(parsed.attachments[0]?.data)).toBe("image-bytes");
  });
});

describe("import planning", () => {
  test("skips existing notes and attachments by default", () => {
    const parsed = parseExportBundle(
      buildExportBundle({
        notes: [note("/existing", "new"), note("/new", "created")],
        attachments: [attachment("same.png")],
        exportedAt: "2026-05-09T00:00:00.000Z",
      }),
    );

    const plan = createImportPlan(parsed, {
      existingNotes: [note("/existing", "old")],
      existingAttachments: [existingAttachment("same.png")],
      conflictMode: "skip",
    });

    expect(plan.notesToSkip).toEqual(["/existing"]);
    expect(plan.notesToInsert.map((n) => n.path)).toEqual(["/new"]);
    expect(plan.notesToUpdate).toEqual([]);
    expect(plan.attachmentsToWrite).toEqual([]);
    expect(plan.attachmentIdRewrites).toEqual({});
  });

  test("renames conflicting notes and attachment ids while rewriting markdown references", () => {
    const parsed = parseExportBundle(
      buildExportBundle({
        notes: [note("/existing", "![diagram](attachment://same.png)")],
        attachments: [attachment("same.png")],
        exportedAt: "2026-05-09T00:00:00.000Z",
      }),
    );

    const plan = createImportPlan(parsed, {
      existingNotes: [note("/existing", "old"), note("/existing (imported)", "older")],
      existingAttachments: [existingAttachment("same.png", 999)],
      conflictMode: "rename",
      now: 100,
    });

    expect(plan.notesToInsert).toMatchObject([
      {
        path: "/existing (imported 2)",
        content: "![diagram](attachment://same-imported.png)",
        createdAt: 100,
        updatedAt: 100,
      },
    ]);
    expect(plan.attachmentsToWrite[0]?.meta.id).toBe("same-imported.png");
    expect(plan.attachmentIdRewrites).toEqual({ "same.png": "same-imported.png" });
  });

  test("overwrites existing notes and attachments when requested", () => {
    const parsed = parseExportBundle(
      buildExportBundle({
        notes: [note("/existing", "new")],
        attachments: [attachment("same.png", "new-bytes")],
        exportedAt: "2026-05-09T00:00:00.000Z",
      }),
    );

    const plan = createImportPlan(parsed, {
      existingNotes: [note("/existing", "old")],
      existingAttachments: [existingAttachment("same.png")],
      conflictMode: "overwrite",
      now: 100,
    });

    expect(plan.notesToUpdate).toMatchObject([
      { path: "/existing", content: "new", updatedAt: 100 },
    ]);
    expect(plan.attachmentsToWrite[0]?.meta.id).toBe("same.png");
  });
});
