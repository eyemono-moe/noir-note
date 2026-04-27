import { Dialog } from "@ark-ui/solid";
import { type Component, For, Show, createResource } from "solid-js";
import { Portal } from "solid-js/web";

import {
  deleteImage,
  deleteOrphanedImages,
  getStorageEstimate,
  listImages,
} from "../../db/imageStore";
import { queryAllMemos } from "../../db/rxdb";
import {
  closeAttachmentManager,
  useAttachmentManagerOpen,
} from "../../store/attachmentManagerStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AttachmentInfo {
  id: string;
  size: number;
  lastModified: number;
  referencedBy: string[]; // note paths that contain attachment://{id}
}

interface AttachmentData {
  attachments: AttachmentInfo[];
  totalSize: number;
  estimate: StorageEstimate;
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

const ATTACHMENT_REF_RE = /attachment:\/\/([^\s)"']+)/g;

async function loadAttachmentData(): Promise<AttachmentData> {
  const [files, memos, estimate] = await Promise.all([
    listImages(),
    queryAllMemos(),
    getStorageEstimate(),
  ]);

  // Build reference map: attachmentId → [notePath, ...]
  const refMap = new Map<string, string[]>();
  for (const memo of memos) {
    for (const match of memo.content.matchAll(ATTACHMENT_REF_RE)) {
      const id = match[1];
      const existing = refMap.get(id) ?? [];
      existing.push(memo.path);
      refMap.set(id, existing);
    }
  }

  const attachments: AttachmentInfo[] = files.map((f) => ({
    ...f,
    referencedBy: refMap.get(f.id) ?? [],
  }));

  // Sort: unreferenced first, then by lastModified descending
  attachments.sort((a, b) => {
    if (a.referencedBy.length === 0 && b.referencedBy.length > 0) return -1;
    if (a.referencedBy.length > 0 && b.referencedBy.length === 0) return 1;
    return b.lastModified - a.lastModified;
  });

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  return { attachments, totalSize, estimate };
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const StorageBar: Component<{ used: number; quota: number }> = (props) => {
  const pct = () => Math.min((props.used / props.quota) * 100, 100);

  return (
    <div class="bg-surface-secondary h-1.5 w-full overflow-hidden rounded-full">
      <div
        class="bg-text-accent h-full rounded-full transition-all"
        style={{ width: `${pct()}%` }}
      />
    </div>
  );
};

const AttachmentRow: Component<{
  att: AttachmentInfo;
  onDelete: (id: string) => void;
}> = (props) => {
  const isOrphan = () => props.att.referencedBy.length === 0;
  const filename = () => {
    // Strip the UUID prefix ({uuid}-filename) for display
    const name = props.att.id;
    const match = name.match(/^[0-9a-f-]{36}-(.+)$/i);
    return match ? match[1] : name;
  };

  return (
    <div
      class={`flex items-start gap-3 rounded-lg p-3 ${isOrphan() ? "bg-surface-transparent-hover border-border-primary border" : "hover:bg-surface-transparent-hover"}`}
    >
      {/* File icon */}
      <span
        class={`i-material-symbols:image-outline mt-0.5 size-5 shrink-0 ${isOrphan() ? "text-text-secondary" : "text-text-accent"}`}
      />

      {/* File info */}
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="text-text-primary truncate text-sm font-medium" title={props.att.id}>
            {filename()}
          </span>
          <Show when={isOrphan()}>
            <span class="text-text-secondary bg-surface-secondary shrink-0 rounded px-1.5 py-0.5 text-xs">
              Unused
            </span>
          </Show>
        </div>
        <div class="text-text-secondary mt-0.5 flex gap-3 text-xs">
          <span>{formatBytes(props.att.size)}</span>
          <span>{formatDate(props.att.lastModified)}</span>
        </div>
        <Show when={!isOrphan()}>
          <div class="mt-1 flex flex-wrap gap-1">
            <For each={props.att.referencedBy}>
              {(path) => (
                <span class="text-text-secondary bg-surface-secondary rounded px-1.5 py-0.5 font-mono text-xs">
                  {path}
                </span>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Delete button */}
      <button
        type="button"
        class="text-text-secondary hover:text-text-danger focus-ring shrink-0 rounded p-1 transition-colors"
        title="Delete attachment"
        onClick={() => props.onDelete(props.att.id)}
      >
        <span class="i-material-symbols:delete-outline-rounded size-4" />
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const AttachmentManager: Component = () => {
  const isOpen = useAttachmentManagerOpen();

  // Load data whenever the dialog is open; refetch() is called after mutations.
  const [data, { refetch }] = createResource(isOpen, () => loadAttachmentData());

  const handleDelete = async (id: string) => {
    await deleteImage(id);
    void refetch();
  };

  const handleCleanUpUnused = async () => {
    const attachments = data()?.attachments ?? [];
    const referencedIds = new Set(
      attachments.filter((a) => a.referencedBy.length > 0).map((a) => a.id),
    );
    await deleteOrphanedImages(referencedIds);
    void refetch();
  };

  const unusedCount = () =>
    data()?.attachments.filter((a) => a.referencedBy.length === 0).length ?? 0;

  return (
    <Dialog.Root
      open={isOpen()}
      onOpenChange={(details) => {
        if (!details.open) closeAttachmentManager();
      }}
    >
      <Portal>
        <Dialog.Backdrop class="bg-overlay fixed inset-0 z-50" />
        <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content class="border-border-primary bg-surface-primary flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl border shadow-xl">
            {/* Header */}
            <div class="border-border-primary flex items-center justify-between border-b px-6 py-4">
              <Dialog.Title class="text-text-primary text-lg font-semibold">
                Attachments
              </Dialog.Title>
              <Dialog.CloseTrigger class="text-text-secondary hover:text-text-primary focus-ring rounded-lg p-1 transition-colors">
                <span class="i-material-symbols:close-rounded size-5" />
              </Dialog.CloseTrigger>
            </div>

            {/* Storage stats */}
            <Show when={data()}>
              {(d) => (
                <div class="border-border-primary border-b px-6 py-4">
                  <div class="mb-2 flex items-center justify-between text-sm">
                    <span class="text-text-secondary">Attachments storage</span>
                    <span class="text-text-primary font-medium">
                      {formatBytes(d().totalSize)}
                      <Show when={d().estimate.quota}>
                        {(quota) => (
                          <span class="text-text-secondary font-normal">
                            {" "}
                            / {formatBytes(quota())} available to origin
                          </span>
                        )}
                      </Show>
                    </span>
                  </div>
                  <Show when={d().estimate.quota && d().estimate.usage != null}>
                    <StorageBar used={d().estimate.usage!} quota={d().estimate.quota!} />
                    <p class="text-text-secondary mt-1 text-xs">
                      Origin total usage: {formatBytes(d().estimate.usage!)} (includes notes and
                      other data)
                    </p>
                  </Show>
                </div>
              )}
            </Show>

            {/* Attachment list */}
            <div class="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <Show
                when={!data.loading}
                fallback={
                  <div class="text-text-secondary flex h-24 items-center justify-center text-sm">
                    Loading…
                  </div>
                }
              >
                <Show
                  when={(data()?.attachments.length ?? 0) > 0}
                  fallback={
                    <div class="text-text-secondary flex h-24 flex-col items-center justify-center gap-1 text-sm">
                      <span class="i-material-symbols:image-not-supported-outline size-8 opacity-40" />
                      <span>No attachments yet</span>
                    </div>
                  }
                >
                  <div class="flex flex-col gap-1">
                    <For each={data()?.attachments}>
                      {(att) => <AttachmentRow att={att} onDelete={handleDelete} />}
                    </For>
                  </div>
                </Show>
              </Show>
            </div>

            {/* Footer */}
            <div class="border-border-primary flex items-center justify-between border-t px-6 py-4">
              <div class="text-text-secondary text-sm">
                {data()?.attachments.length ?? 0} file(s)
                <Show when={unusedCount() > 0}>
                  <span class="text-text-secondary"> · {unusedCount()} unused</span>
                </Show>
              </div>
              <div class="flex gap-3">
                <Show when={unusedCount() > 0}>
                  <button
                    type="button"
                    class="button text-text-danger text-sm"
                    onClick={handleCleanUpUnused}
                  >
                    <span class="i-material-symbols:delete-sweep-outline-rounded mr-1 size-4" />
                    Clean up unused ({unusedCount()})
                  </button>
                </Show>
                <Dialog.CloseTrigger class="button text-text-primary text-sm">
                  Close
                </Dialog.CloseTrigger>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};

export default AttachmentManager;
