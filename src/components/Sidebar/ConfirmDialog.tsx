import { Dialog } from "@ark-ui/solid";
import { type Component } from "solid-js";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: Component<ConfirmDialogProps> = (props) => {
  return (
    <Dialog.Root
      open={props.open}
      onOpenChange={(details) => {
        if (!details.open) props.onCancel();
      }}
    >
      <Dialog.Backdrop class="bg-overlay fixed inset-0 z-50" />
      <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center">
        <Dialog.Content class="border-border-primary bg-surface-primary w-96 max-w-[90vw] rounded-xl border p-6 shadow-xl">
          <Dialog.Title class="text-text-primary text-lg font-semibold">{props.title}</Dialog.Title>
          <Dialog.Description class="text-text-secondary mt-2 text-sm text-wrap break-words whitespace-pre-wrap">
            {props.description}
          </Dialog.Description>

          <div class="mt-6 flex justify-end gap-3">
            <button onClick={() => props.onCancel()} class="text-text-primary button">
              {props.cancelLabel ?? "Cancel"}
            </button>
            <button
              onClick={() => props.onConfirm()}
              classList={{
                button: true,
                "text-text-accent": props.variant === "default",
                "text-text-danger": props.variant === "danger",
              }}
            >
              {props.confirmLabel ?? "Confirm"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};

export default ConfirmDialog;
