import { createToaster, type ToastOptions } from "@ark-ui/solid/toast";

export type AppToastType = "loading" | "success" | "error" | "info";
export type AppToast = Omit<ToastOptions, "type"> & {
  id?: string;
  type: AppToastType;
};
export type AppToastPatch = Partial<Omit<AppToast, "id">>;

export const toaster = createToaster({
  placement: "bottom-end",
  overlap: true,
  gap: 8,
});

export function showToast(input: AppToast): string {
  return toaster.create(input);
}

export function updateToast(id: string, patch: AppToastPatch): void {
  toaster.update(id, patch);
}

export function dismissToast(id: string): void {
  toaster.dismiss(id);
}
