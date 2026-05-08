import { Toast, Toaster, type ToastOptions } from "@ark-ui/solid/toast";
import { Show } from "solid-js";
import { Portal } from "solid-js/web";

import { toaster, type AppToastType } from "../../store/toastStore";

function iconFor(type: AppToastType | undefined): string {
  switch (type) {
    case "loading":
      return "i-material-symbols:progress-activity animate-spin text-text-accent";
    case "success":
      return "i-material-symbols:check-circle text-text-accent";
    case "error":
      return "i-material-symbols:error text-text-danger";
    case "info":
    default:
      return "i-material-symbols:info text-text-secondary";
  }
}

function ToastItem(props: { toast: () => ToastOptions }) {
  const type = () => props.toast().type as AppToastType | undefined;

  return (
    <Toast.Root
      class="bg-surface-secondary border-border-primary text-text-primary flex w-80 max-w-[calc(100vw-2rem)] items-start gap-3 rounded-lg border p-3 shadow-lg transition-[translate,scale,opacity,height,box-shadow] duration-400 data-[state=closed]:opacity-0"
      style={{
        translate: "var(--x) var(--y)",
        scale: "var(--scale)",
        "z-index": "var(--z-index)",
        height: "var(--height)",
        opacity: "var(--opacity)",
        "will-change": "translate, opacity, scale",
        "transition-timing-function": "cubic-bezier(0.21, 1.02, 0.73, 1)",
      }}
    >
      <span class={`mt-0.5 size-5 shrink-0 ${iconFor(type())}`} aria-hidden="true" />
      <div class="min-w-0 flex-1">
        <Toast.Title class="text-sm font-medium">{props.toast().title}</Toast.Title>
        <Show when={props.toast().description}>
          {(description) => (
            <Toast.Description class="text-text-secondary mt-1 text-xs">
              {description()}
            </Toast.Description>
          )}
        </Show>
      </div>
      <Toast.CloseTrigger
        class="focus-ring text-text-secondary hover:text-text-primary inline-flex rounded bg-transparent p-0.5 transition-colors"
        aria-label="Dismiss notification"
      >
        <span class="i-material-symbols:close size-4 shrink-0" aria-hidden="true" />
      </Toast.CloseTrigger>
    </Toast.Root>
  );
}

export default function ToastViewport() {
  return (
    <Portal>
      <Toaster toaster={toaster}>{(toast) => <ToastItem toast={toast} />}</Toaster>
    </Portal>
  );
}
