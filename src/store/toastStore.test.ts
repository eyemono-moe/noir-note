import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

type MockToaster = {
  create: (data: unknown) => string;
  update: (id: string, data: unknown) => string;
  dismiss: (id?: string) => void;
};

const createMock = vi.fn<(data: unknown) => string>(() => "toast-id");
const updateMock = vi.fn<(id: string, data: unknown) => string>(() => "toast-id");
const dismissMock = vi.fn<(id?: string) => void>();
const createToasterMock = vi.fn<() => MockToaster>(() => ({
  create: createMock,
  update: updateMock,
  dismiss: dismissMock,
}));

vi.mock("@ark-ui/solid/toast", () => ({
  createToaster: createToasterMock,
}));

describe("toastStore", () => {
  beforeEach(() => {
    createMock.mockClear();
    updateMock.mockClear();
    dismissMock.mockClear();
    createToasterMock.mockClear();
  });

  test("configures Ark UI toaster placement for app notifications", async () => {
    await import("./toastStore");

    expect(createToasterMock).toHaveBeenCalledWith({
      placement: "bottom-end",
      overlap: true,
      gap: 8,
    });
  });

  test("delegates show, update, and dismiss operations to the Ark UI toaster", async () => {
    const { dismissToast, showToast, updateToast } = await import("./toastStore");

    const id = showToast({ type: "loading", title: "Saving images…" });
    updateToast(id, { type: "success", title: "Inserted images", duration: 3000 });
    dismissToast(id);

    expect(id).toBe("toast-id");
    expect(createMock).toHaveBeenCalledWith({ type: "loading", title: "Saving images…" });
    expect(updateMock).toHaveBeenCalledWith("toast-id", {
      type: "success",
      title: "Inserted images",
      duration: 3000,
    });
    expect(dismissMock).toHaveBeenCalledWith("toast-id");
  });
});
