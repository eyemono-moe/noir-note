import { describe, expect, test, vi } from "vite-plus/test";

vi.mock("../db/attachmentCollection", () => ({
  addAttachment: vi.fn<(file: File) => Promise<string>>(),
}));

import { insertImages } from "./imagePaste";

describe("insertImages", () => {
  type DispatchSpec = {
    changes: { from: number; insert: string };
    selection: { anchor: number };
  };

  type AddAttachmentFn = (file: File) => Promise<string>;
  type ShowToastFn = (input: unknown) => string;
  type UpdateToastFn = (id: string, patch: unknown) => void;

  function file(name: string): File {
    return new File(["image"], name, { type: "image/png" });
  }

  test("shows loading then success toast and inserts markdown for saved images", async () => {
    const dispatch = vi.fn<(spec: DispatchSpec) => void>();
    const focus = vi.fn<() => void>();
    const showToast = vi.fn<ShowToastFn>(() => "toast-1");
    const updateToast = vi.fn<UpdateToastFn>();

    await insertImages([file("first.png"), file("second.png")], { dispatch, focus }, 3, {
      addAttachment: vi.fn<AddAttachmentFn>(async (f: File) => `id-${f.name}`),
      showToast,
      updateToast,
    });

    expect(showToast).toHaveBeenCalledWith({ type: "loading", title: "Saving 2 images…" });
    expect(dispatch).toHaveBeenCalledWith({
      changes: {
        from: 3,
        insert: "![first](attachment://id-first.png)\n![second](attachment://id-second.png)",
      },
      selection: { anchor: 76 },
    });
    expect(updateToast).toHaveBeenCalledWith("toast-1", {
      type: "success",
      title: "Inserted 2 images",
      duration: 3000,
    });
    expect(focus).toHaveBeenCalledOnce();
  });

  test("inserts successful images and reports partial failures", async () => {
    const dispatch = vi.fn<(spec: DispatchSpec) => void>();
    const focus = vi.fn<() => void>();
    const updateToast = vi.fn<UpdateToastFn>();

    await insertImages([file("ok.png"), file("bad.png")], { dispatch, focus }, 0, {
      addAttachment: vi.fn<AddAttachmentFn>(async (f: File) => {
        if (f.name === "bad.png") throw new Error("quota exceeded");
        return "ok-id";
      }),
      showToast: vi.fn<ShowToastFn>(() => "toast-2"),
      updateToast,
    });

    expect(dispatch).toHaveBeenCalledWith({
      changes: { from: 0, insert: "![ok](attachment://ok-id)" },
      selection: { anchor: 25 },
    });
    expect(updateToast).toHaveBeenCalledWith("toast-2", {
      type: "error",
      title: "Inserted 1 of 2 images",
      description: "Failed to save 1 image: quota exceeded",
      duration: 6000,
    });
    expect(focus).toHaveBeenCalledOnce();
  });

  test("reports an error without changing the editor when all image saves fail", async () => {
    const dispatch = vi.fn<(spec: DispatchSpec) => void>();
    const focus = vi.fn<() => void>();
    const updateToast = vi.fn<UpdateToastFn>();

    await insertImages([file("bad.png")], { dispatch, focus }, 0, {
      addAttachment: vi.fn<AddAttachmentFn>(async () => {
        throw new Error("OPFS unavailable");
      }),
      showToast: vi.fn<ShowToastFn>(() => "toast-3"),
      updateToast,
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(updateToast).toHaveBeenCalledWith("toast-3", {
      type: "error",
      title: "Failed to insert image",
      description: "OPFS unavailable",
      duration: 6000,
    });
    expect(focus).not.toHaveBeenCalled();
  });
});
