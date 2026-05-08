import { For, Show } from "solid-js";
import { Portal } from "solid-js/web";

import { dismissToast, toasts, type Toast, type ToastType } from "../../store/toastStore";

function iconFor(type: ToastType): string {
  switch (type) {
    case "loading":
      return "i-material-symbols:progress-activity animate-spin text-text-accent";
    case "success":
      return "i-material-symbols:check-circle text-text-accent";
    case "error":
      return "i-material-symbols:error text-text-danger";
    case "info":
      return "i-material-symbols:info text-text-secondary";
  }
}

function ToastItem(props: { toast: Toast }) {
  return (
    <div
      role={props.toast.type === "error" ? "alert" : "status"}
      class="bg-surface-secondary border-border-primary text-text-primary flex w-80 max-w-[calc(100vw-2rem)] items-start gap-3 rounded-lg border p-3 shadow-lg"
    >
      <span class={`mt-0.5 size-5 shrink-0 ${iconFor(props.toast.type)}`} aria-hidden="true" />
      <div class="min-w-0 flex-1">
        <div class="text-sm font-medium">{props.toast.title}</div>
        <Show when={props.toast.description}>
          {(description) => <div class="text-text-secondary mt-1 text-xs">{description()}</div>}
        </Show>
      </div>
      <button
        type="button"
        class="focus-ring text-text-secondary hover:text-text-primary inline-flex rounded p-0.5 transition-colors"
        aria-label="Dismiss notification"
        onClick={() => dismissToast(props.toast.id)}
      >
        <span class="i-material-symbols:close size-4 shrink-0" aria-hidden="true" />
      </button>
    </div>
  );
}

export default function ToastViewport() {
  return (
    <Portal>
      <div
        class="pointer-events-none fixed right-4 bottom-4 z-100 flex flex-col gap-2"
        aria-live="polite"
        aria-relevant="additions text"
      >
        <For each={toasts()}>
          {(toast) => (
            <div class="pointer-events-auto">
              <ToastItem toast={toast} />
            </div>
          )}
        </For>
      </div>
    </Portal>
  );
}
