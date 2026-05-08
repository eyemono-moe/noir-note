import { describe, expect, test, vi } from "vite-plus/test";

import { dismissToast, showToast, toasts, updateToast } from "./toastStore";

describe("toastStore", () => {
  test("adds, updates, and dismisses toast notifications", () => {
    const id = showToast({ type: "loading", title: "Saving images…" });

    expect(toasts()).toEqual([
      expect.objectContaining({ id, type: "loading", title: "Saving images…" }),
    ]);

    updateToast(id, { type: "success", title: "Inserted images" });

    expect(toasts()).toEqual([
      expect.objectContaining({ id, type: "success", title: "Inserted images" }),
    ]);

    dismissToast(id);

    expect(toasts()).toEqual([]);
  });

  test("automatically dismisses toast notifications after their duration", () => {
    vi.useFakeTimers();
    try {
      const id = showToast({ type: "success", title: "Inserted image", duration: 1000 });

      expect(toasts()).toEqual([expect.objectContaining({ id })]);

      vi.advanceTimersByTime(999);
      expect(toasts()).toEqual([expect.objectContaining({ id })]);

      vi.advanceTimersByTime(1);
      expect(toasts()).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});
