import {
  type Component,
  For,
  Show,
  createEffect,
  createResource,
  createSignal,
  onCleanup,
} from "solid-js";

import {
  deleteImage,
  deleteOrphanedImages,
  getImageUrl,
  getStorageEstimate,
  listImages,
} from "../../../db/imageStore";
import { queryAllMemos } from "../../../db/rxdb";

// ---------------------------------------------------------------------------
// Types & data loading
// ---------------------------------------------------------------------------

interface AttachmentInfo {
  id: string;
  size: number;
  lastModified: number;
  referencedBy: string[];
}

interface AttachmentData {
  attachments: AttachmentInfo[];
  totalSize: number;
  estimate: StorageEstimate;
}

const ATTACHMENT_REF_RE = /attachment:\/\/([^\s)"']+)/g;

async function loadAttachmentData(): Promise<AttachmentData> {
  const [files, memos, estimate] = await Promise.all([
    listImages(),
    queryAllMemos(),
    getStorageEstimate(),
  ]);

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

  // Unused first, then newest first
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

// ---------------------------------------------------------------------------
// ThumbnailImage
// Same initialValue / .latest pattern as ImageNode to avoid Suspense throws.
// ---------------------------------------------------------------------------

const ThumbnailImage: Component<{ id: string }> = (props) => {
  const [objectUrl] = createResource(
    () => props.id,
    (id) => getImageUrl(id),
    {
      initialValue: null,
    },
  );

  createEffect(() => {
    const url = objectUrl.latest;
    onCleanup(() => {
      if (url) URL.revokeObjectURL(url);
    });
  });

  return (
    <Show
      when={objectUrl.latest}
      fallback={
        <div class="bg-surface-secondary flex size-9 shrink-0 items-center justify-center rounded">
          <span class="i-material-symbols:image-outline text-text-secondary size-5" />
        </div>
      }
    >
      {(url) => <img src={url()} alt="" class="size-9 shrink-0 rounded object-cover" />}
    </Show>
  );
};

// ---------------------------------------------------------------------------
// AttachmentRow
// ---------------------------------------------------------------------------

const AttachmentRow: Component<{
  att: AttachmentInfo;
  onDelete: (id: string) => void;
}> = (props) => {
  const isOrphan = () => props.att.referencedBy.length === 0;

  // Strip the UUID prefix for display: "{uuid}-filename.ext" → "filename.ext"
  const filename = () => {
    const match = props.att.id.match(/^[0-9a-f-]{36}-(.+)$/i);
    return match ? match[1] : props.att.id;
  };

  return (
    <div class="group flex items-center gap-2 rounded-md px-2 py-1.5">
      <ThumbnailImage id={props.att.id} />

      <div class="min-w-0 flex-1">
        <p
          class="text-text-primary truncate text-xs leading-tight font-medium"
          title={props.att.id}
        >
          {filename()}
        </p>
        <p class="text-text-secondary mt-0.5 text-xs leading-tight">
          {formatBytes(props.att.size)}
          <Show when={isOrphan()}>
            <span class="bg-surface-secondary text-text-secondary ml-1 rounded px-1 py-px text-[0.625rem]">
              Unused
            </span>
          </Show>
          <Show when={!isOrphan()}>
            <span class="ml-1">
              · {props.att.referencedBy.length} note
              {props.att.referencedBy.length > 1 ? "s" : ""}
            </span>
          </Show>
        </p>
      </div>

      <button
        type="button"
        class="focus-ring text-text-secondary hover:text-text-danger inline-flex shrink-0 appearance-none rounded bg-transparent p-0.5 opacity-0 transition-all group-hover:opacity-100"
        title="Delete attachment"
        onClick={() => props.onDelete(props.att.id)}
      >
        <span class="i-material-symbols:delete-outline-rounded size-3.5" />
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// StorageBar
// ---------------------------------------------------------------------------

const StorageBar: Component<{ used: number; quota: number }> = (props) => {
  const pct = () => Math.min((props.used / props.quota) * 100, 100);
  return (
    <div class="bg-surface-secondary h-1 w-full overflow-hidden rounded-full">
      <div
        class="bg-text-accent h-full rounded-full transition-all"
        style={{ width: `${pct()}%` }}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// AttachmentsTab
// ---------------------------------------------------------------------------

export const AttachmentsTab: Component = () => {
  const [tick, setTick] = createSignal(0);
  const [data, { refetch }] = createResource(tick, () => loadAttachmentData());

  const handleDelete = async (id: string) => {
    await deleteImage(id);
    void refetch();
  };

  const handleCleanUp = async () => {
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
    <div class="flex h-full flex-col overflow-hidden">
      {/* Section header */}
      <div class="flex shrink-0 items-center justify-between px-3 py-1.5">
        <span class="text-text-secondary text-[0.6875rem] font-bold tracking-[0.06em] uppercase">
          Attachments
        </span>
        <button
          type="button"
          class="focus-ring text-text-secondary hover:text-text-primary inline-flex appearance-none rounded bg-transparent p-0.5 transition-colors"
          title="Refresh"
          onClick={() => setTick((n) => n + 1)}
        >
          <span class="i-material-symbols:refresh-rounded size-3.5" />
        </button>
      </div>

      {/* Storage stats */}
      <Show when={data()}>
        {(d) => (
          <div class="border-border-primary shrink-0 border-b px-3 pb-2">
            <div class="mb-1 flex items-baseline justify-between">
              <span class="text-text-primary text-xs font-medium">
                {formatBytes(d().totalSize)}
              </span>
              <Show when={d().estimate.quota}>
                {(q) => (
                  <span class="text-text-secondary text-[0.625rem]">/ {formatBytes(q())}</span>
                )}
              </Show>
            </div>
            <Show when={d().estimate.quota && d().estimate.usage != null}>
              <StorageBar used={d().estimate.usage!} quota={d().estimate.quota!} />
              <p class="text-text-secondary mt-0.5 text-[0.625rem]">
                Origin: {formatBytes(d().estimate.usage!)} used
              </p>
            </Show>
          </div>
        )}
      </Show>

      {/* File list */}
      <div class="min-h-0 flex-1 overflow-y-auto px-1 py-1">
        <Show
          when={!data.loading}
          fallback={
            <div class="text-text-secondary flex h-16 items-center justify-center text-xs">
              Loading…
            </div>
          }
        >
          <Show
            when={(data()?.attachments.length ?? 0) > 0}
            fallback={
              <div class="text-text-secondary flex h-24 flex-col items-center justify-center gap-1 text-xs">
                <span class="i-material-symbols:image-not-supported-outline size-6 opacity-40" />
                <span>No attachments yet</span>
              </div>
            }
          >
            <For each={data()?.attachments}>
              {(att) => <AttachmentRow att={att} onDelete={handleDelete} />}
            </For>
          </Show>
        </Show>
      </div>

      {/* Footer: clean up button */}
      <Show when={unusedCount() > 0}>
        <div class="border-border-primary shrink-0 border-t p-2">
          <button
            type="button"
            class="button text-text-danger w-full justify-center text-xs"
            onClick={handleCleanUp}
          >
            <span class="i-material-symbols:delete-sweep-outline-rounded mr-1 size-3.5" />
            Clean up unused ({unusedCount()})
          </button>
        </div>
      </Show>
    </div>
  );
};
