import { createStore, produce } from "solid-js/store";

export type ToastType = "loading" | "success" | "error" | "info";

export type Toast = {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
};

type ToastInput = Omit<Toast, "id"> & { id?: string };
type ToastPatch = Partial<Omit<Toast, "id">>;

const [toastList, setToastList] = createStore<Toast[]>([]);
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

function createToastId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `toast-${Date.now()}-${Math.random()}`;
}

function clearDismissTimer(id: string): void {
  const timer = dismissTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    dismissTimers.delete(id);
  }
}

function scheduleDismiss(id: string, duration?: number): void {
  clearDismissTimer(id);
  if (duration == null || duration <= 0) return;

  dismissTimers.set(
    id,
    setTimeout(() => dismissToast(id), duration),
  );
}

export function toasts(): Toast[] {
  return [...toastList];
}

export function showToast(input: ToastInput): string {
  const id = input.id ?? createToastId();
  const toast: Toast = { ...input, id };

  setToastList((items) => [...items, toast]);
  scheduleDismiss(id, toast.duration);

  return id;
}

export function updateToast(id: string, patch: ToastPatch): void {
  setToastList(
    (toast) => toast.id === id,
    produce((toast) => {
      Object.assign(toast, patch);
    }),
  );

  if ("duration" in patch) {
    scheduleDismiss(id, patch.duration);
  }
}

export function dismissToast(id: string): void {
  clearDismissTimer(id);
  setToastList((items) => items.filter((toast) => toast.id !== id));
}
