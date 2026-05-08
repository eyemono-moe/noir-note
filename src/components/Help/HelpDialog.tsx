import { Dialog } from "@ark-ui/solid/dialog";
import { type Component, lazy, Suspense } from "solid-js";

import { HELP_DIALOG_TITLE, HELP_MARKDOWN_CONTENT } from "../../help/helpContent";

const MarkdownRenderer = lazy(() => import("../Preview/MarkdownRenderer"));

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

export const HelpDialog: Component<HelpDialogProps> = (props) => (
  <Dialog.Root
    open={props.open}
    onOpenChange={(d) => {
      if (!d.open) props.onClose();
    }}
    lazyMount
    unmountOnExit
  >
    <Dialog.Backdrop class="bg-overlay fixed inset-0 z-50" />
    <Dialog.Positioner class="pointer-events-auto fixed inset-x-0 top-1/2 z-50 flex max-h-screen -translate-y-1/2 items-start justify-center p-4">
      <Dialog.Content
        class="border-border-primary bg-surface-primary grid max-h-screen w-[48rem] max-w-[95vw] grid-rows-[auto_1fr] overflow-hidden rounded-xl border shadow-xl"
        style={{ "max-height": "calc(90dvh - 2rem)" }}
      >
        <div class="border-border-primary flex shrink-0 items-center gap-2 border-b px-4 py-3">
          <Dialog.Title class="text-text-primary flex-1 text-sm font-semibold">
            {HELP_DIALOG_TITLE}
          </Dialog.Title>
          <Dialog.CloseTrigger class="focus-ring hover:bg-surface-transparent-hover text-text-secondary inline-flex appearance-none rounded bg-transparent p-1 transition-colors">
            <span class="i-material-symbols:close-rounded size-4" />
          </Dialog.CloseTrigger>
        </div>
        <Suspense
          fallback={
            <div class="text-text-secondary flex h-40 items-center justify-center text-sm">
              Loading…
            </div>
          }
        >
          <MarkdownRenderer content={HELP_MARKDOWN_CONTENT} />
        </Suspense>
      </Dialog.Content>
    </Dialog.Positioner>
  </Dialog.Root>
);
