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
      <Dialog.Backdrop class="fixed inset-0 z-50 bg-black/50" />
      <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center">
        <Dialog.Content class="w-96 max-w-[90vw] rounded-lg border border-gray-300 bg-white p-6 shadow-xl">
          <Dialog.Title class="text-lg font-semibold text-gray-900">{props.title}</Dialog.Title>
          <Dialog.Description class="mt-2 text-sm text-gray-600">
            {props.description}
          </Dialog.Description>

          <div class="mt-6 flex justify-end gap-3">
            <button
              onClick={() => props.onCancel()}
              class="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {props.cancelLabel ?? "Cancel"}
            </button>
            <button
              onClick={() => props.onConfirm()}
              class={`rounded px-4 py-2 text-sm font-medium text-white ${
                props.variant === "danger"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
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
