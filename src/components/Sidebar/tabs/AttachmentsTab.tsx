import { Clipboard } from "@ark-ui/solid";
import { Collapsible } from "@ark-ui/solid/collapsible";
import { Dialog } from "@ark-ui/solid/dialog";
import { HoverCard } from "@ark-ui/solid/hover-card";
import { useNavigate } from "@solidjs/router";
import { useLiveQuery } from "@tanstack/solid-db";
import {
  type Component,
  For,
  Show,
  Suspense,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  lazy,
  onCleanup,
} from "solid-js";
import { Portal } from "solid-js/web";

import {
  addAttachment,
  attachmentsCollection,
  removeAttachment,
  type AttachmentMeta,
} from "../../../db/attachmentCollection";
import { getImageUrl, getStorageEstimate } from "../../../db/imageStore";
import { queryMemoPathsReferencingAttachment } from "../../../db/memoCollection";
import { noteStore } from "../../../db/noteStore";

import treeStyles from "../tree.module.css";

const MemoPreview = lazy(() => import("../MemoPreview"));

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
// Uses .latest to avoid throwing a Suspense-propagating Promise.
// ---------------------------------------------------------------------------

const ThumbnailImage: Component<{ id: string }> = (props) => {
  const [objectUrl] = createResource(
    () => props.id,
    (id) => getImageUrl(id),
    { initialValue: null },
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
// NoteItem
// Reuses the HoverCard + MemoPreview pattern from RecentNotes / Tree.
// HoverCard.Root is lifted to AttachmentsTab; this component only renders the trigger.
// ---------------------------------------------------------------------------

const NoteItem: Component<{
  path: string;
  onNavigate: (path: string) => void;
}> = (props) => {
  return (
    <HoverCard.Trigger
      value={props.path}
      asChild={(hoverProps) => (
        <button
          type="button"
          class="focus-ring text-text-secondary hover:text-text-primary flex w-full min-w-0 items-center gap-1 rounded bg-transparent px-1 py-0.5 text-left text-[0.625rem] transition-colors"
          title={props.path}
          onClick={() => props.onNavigate(props.path)}
          {...hoverProps()}
        >
          <span class="i-material-symbols:description-outline-rounded size-3 shrink-0" />
          <span class="truncate">{props.path}</span>
        </button>
      )}
    />
  );
};

// ---------------------------------------------------------------------------
// AttachmentRow
//
// `att`         — stable proxy ref from TanStack DB (ThumbnailImage never remounts)
// `onNavigate`  — navigate to a note path
// `onDelete`    — called after confirming deletion
//
// Reference computation is lazy:
//   - Loaded on first Collapsible open (cached for the row's lifetime)
//   - Re-queried on every delete attempt (to show up-to-date warning)
// ---------------------------------------------------------------------------

const AttachmentRow: Component<{
  att: AttachmentMeta;
  onDelete: (id: string) => void;
  onNavigate: (path: string) => void;
}> = (props) => {
  // Collapsible open/close state (controlled so we can trigger the fetch)
  const [expanded, setExpanded] = createSignal(false);

  // Lazy-load referenced note paths — fires only on first expand.
  // att.id is included in the source so the fetcher is a plain async function
  // with no reactive reads (avoids solid/reactivity lint warning).
  const [refs] = createResource(
    () => (expanded() ? props.att.id : null),
    (id) => queryMemoPathsReferencingAttachment(id),
  );

  // Delete confirmation state: null = not shown, string[] = paths that reference this file
  const [deleteRefs, setDeleteRefs] = createSignal<string[] | null>(null);

  const handleDeleteClick = async () => {
    const paths = await queryMemoPathsReferencingAttachment(props.att.id);
    if (paths.length === 0) {
      props.onDelete(props.att.id);
    } else {
      setDeleteRefs(paths);
    }
  };

  const filename = () => {
    const match = props.att.id.match(/^[0-9a-f-]{36}-(.+)$/i);
    return match ? match[1] : props.att.id;
  };

  const markdownRef = () =>
    `![${filename().replace(/\.[^.]+$/, "")}](attachment://${props.att.id})`;

  // Count from cached resource (null while not yet loaded).
  // oxlint-disable-next-line solid/reactivity --- called only inside JSX (tracked scope)
  const refCount = () => refs.latest?.length ?? null;

  // Auto-close when refs load and turn out to be empty.
  createEffect(() => {
    if (!refs.loading && refCount() === 0 && expanded()) setExpanded(false);
  });

  return (
    <>
      <Collapsible.Root
        open={expanded()}
        onOpenChange={(d) => setExpanded(d.open)}
        lazyMount
        unmountOnExit
      >
        <div class="group rounded-md px-2 py-1.5">
          {/* Main row */}
          <div class="flex items-center gap-2">
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

                {/* Spinner while loading */}
                <Show when={refs.loading}>
                  <span class="i-material-symbols:progress-activity ml-1 inline-block size-3 animate-spin align-middle" />
                </Show>

                {/* Unused badge — loaded with 0 refs */}
                <Show when={!refs.loading && refCount() === 0}>
                  <span class="bg-surface-secondary text-text-secondary ml-1 rounded px-1 py-px text-[0.625rem]">
                    Unused
                  </span>
                </Show>

                {/*
                  Expand trigger — visible when not loading AND refCount is not 0.
                  `refCount() !== 0` is true for both null (unloaded) and N > 0,
                  so the trigger is always present before the first load, giving the
                  user a way to initiate the lazy fetch.
                */}
                <Show when={!refs.loading && refCount() !== 0}>
                  <Collapsible.Trigger
                    asChild={(triggerProps) => (
                      <button
                        type="button"
                        class="text-text-secondary hover:text-text-primary ml-1 inline-flex items-center gap-0.5 bg-transparent p-0 text-xs transition-colors"
                        {...triggerProps()}
                      >
                        <Show
                          when={refCount() !== null}
                          fallback={<span class="mr-0.5">Check refs</span>}
                        >
                          · {refCount()} note{refCount()! > 1 ? "s" : ""}
                        </Show>
                        <Collapsible.Indicator
                          asChild={(indicatorProps) => (
                            <span
                              class="i-material-symbols:expand-more-rounded inline-block size-3 transition-transform data-[state=open]:rotate-180"
                              {...indicatorProps()}
                            />
                          )}
                        />
                      </button>
                    )}
                  />
                </Show>
              </p>
            </div>

            {/* Action buttons — visible on hover */}
            <div class="hidden shrink-0 items-center gap-0.5 group-hover:flex">
              <Clipboard.Root value={markdownRef()}>
                <Clipboard.Trigger
                  title="Copy markdown reference"
                  class="focus-ring text-text-secondary hover:text-text-primary inline-flex appearance-none rounded bg-transparent p-0.5 transition-colors"
                >
                  <Clipboard.Indicator
                    copied={
                      <span class="i-material-symbols:check-rounded text-text-accent block size-3.5" />
                    }
                  >
                    <span class="i-material-symbols:copy-all-outline-rounded block size-3.5" />
                  </Clipboard.Indicator>
                </Clipboard.Trigger>
              </Clipboard.Root>
              <button
                type="button"
                class="focus-ring text-text-secondary hover:text-text-danger inline-flex appearance-none rounded bg-transparent p-0.5 transition-colors"
                title="Delete attachment"
                onClick={handleDeleteClick}
              >
                <span class="i-material-symbols:delete-outline-rounded size-3.5" />
              </button>
            </div>
          </div>

          {/* Expanded referencing notes */}
          <Collapsible.Content>
            <div class="mt-1 ml-11 flex flex-col gap-0.5">
              <Show
                when={!refs.loading}
                fallback={<span class="text-text-secondary text-[0.625rem]">Loading…</span>}
              >
                <For each={refs() ?? []}>
                  {(path) => <NoteItem path={path} onNavigate={props.onNavigate} />}
                </For>
              </Show>
            </div>
          </Collapsible.Content>
        </div>
      </Collapsible.Root>

      {/* Delete confirmation dialog — only shown when the attachment is referenced */}
      <Dialog.Root
        open={deleteRefs() !== null}
        onOpenChange={(d) => {
          if (!d.open) setDeleteRefs(null);
        }}
        role="alertdialog"
      >
        <Dialog.Backdrop class="bg-overlay fixed inset-0 z-50" />
        <Dialog.Positioner class="translate-y--1/2 pointer-events-auto fixed inset-x-0 top-1/2 z-50 flex max-h-full items-start justify-center overflow-y-auto overscroll-y-contain p-4">
          <Dialog.Content class="border-border-primary bg-surface-primary w-96 max-w-[90vw] rounded-xl border p-6 shadow-xl">
            <Dialog.Title class="text-text-primary text-base font-semibold">
              Delete attachment?
            </Dialog.Title>
            <Dialog.Description class="text-text-secondary mt-2 text-sm">
              <span class="text-text-primary font-medium">{filename()}</span> is referenced in{" "}
              {deleteRefs()?.length} note{(deleteRefs()?.length ?? 0) > 1 ? "s" : ""}. Deleting it
              will break those references.
            </Dialog.Description>

            {/* List of referencing notes */}
            <div class="mt-4 flex flex-col gap-0.5">
              <For each={deleteRefs() ?? []}>
                {(path) => <NoteItem path={path} onNavigate={props.onNavigate} />}
              </For>
            </div>

            <div class="mt-6 flex justify-end gap-3">
              <Dialog.CloseTrigger class="button text-text-primary">Cancel</Dialog.CloseTrigger>
              <button
                type="button"
                class="button text-text-danger"
                onClick={() => {
                  setDeleteRefs(null);
                  props.onDelete(props.att.id);
                }}
              >
                Delete anyway
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
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
  const navigate = useNavigate();
  // oxlint-disable-next-line no-unassigned-vars --- needed for ref
  let fileInputRef!: HTMLInputElement;

  const [activePath, setActivePath] = createSignal<string | null>(null);

  // Reactive attachment list — auto-updates on paste/delete from any context
  const attachmentsQuery = useLiveQuery(() => attachmentsCollection);

  // References are NOT computed in real-time here.
  // - Loaded lazily when the user expands an attachment row (per-row createResource)
  // - Checked on-demand when the user clicks delete (to show warning dialog)
  // The memoContentsQuery / refMap approach was removed to avoid re-scanning all
  // note content on every keystroke.

  // Sort by most recently modified — orphan detection is done per-row on demand
  const sortedAttachments = createMemo((): AttachmentMeta[] =>
    [...(attachmentsQuery() ?? [])].sort((a, b) => b.lastModified - a.lastModified),
  );

  // Storage quota/usage — fetched once on mount
  const [estimate] = createResource(getStorageEstimate);

  const attachmentsSize = createMemo(() =>
    (attachmentsQuery() ?? []).reduce((sum, a) => sum + a.size, 0),
  );

  // Notes OPFS size — fetched once on mount via the worker
  const [notesSize] = createResource(() => noteStore.getSize());

  const handleFileChange = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const files = input.files;
    if (!files?.length) return;
    await Promise.all(Array.from(files).map((f) => addAttachment(f)));
    input.value = "";
  };

  return (
    <HoverCard.Root
      lazyMount
      unmountOnExit
      openDelay={600}
      closeDelay={200}
      positioning={{ placement: "right-start", offset: { mainAxis: 8, crossAxis: 0 } }}
      onTriggerValueChange={(e) => setActivePath(e.value)}
    >
      <div class="flex h-full flex-col overflow-hidden">
        {/* Section header */}
        <div class="flex shrink-0 items-center gap-1 px-3 py-1.5">
          <span class="text-text-secondary flex-1 text-[0.6875rem] font-bold tracking-[0.06em] uppercase">
            Attachments
          </span>
          <button
            type="button"
            class="focus-ring text-text-secondary hover:text-text-primary inline-flex appearance-none rounded bg-transparent p-0.5 transition-colors"
            title="Upload image"
            onClick={() => fileInputRef.click()}
          >
            <span class="i-material-symbols:upload-rounded size-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            class="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Storage stats */}
        <Show when={attachmentsQuery.isReady}>
          <div class="border-border-primary shrink-0 border-b px-3 pb-2">
            {/* Per-category breakdown */}
            <div class="mb-1.5 flex flex-col gap-0.5">
              <div class="flex items-baseline justify-between">
                <span class="text-text-secondary text-[0.625rem]">Notes</span>
                <span class="text-text-primary text-[0.625rem] font-medium tabular-nums">
                  {notesSize.loading ? "…" : formatBytes(notesSize() ?? 0)}
                </span>
              </div>
              <div class="flex items-baseline justify-between">
                <span class="text-text-secondary text-[0.625rem]">Attachments</span>
                <span class="text-text-primary text-[0.625rem] font-medium tabular-nums">
                  {formatBytes(attachmentsSize())}
                </span>
              </div>
            </div>
            {/* Origin-wide quota bar */}
            <Show when={estimate()?.quota && estimate()?.usage != null}>
              <StorageBar used={estimate()!.usage!} quota={estimate()!.quota!} />
              <p class="text-text-secondary mt-0.5 text-[0.625rem]">
                Origin: {formatBytes(estimate()!.usage!)} / {formatBytes(estimate()!.quota!)}
              </p>
            </Show>
          </div>
        </Show>

        {/* File list */}
        <div class="min-h-0 flex-1 overflow-y-auto px-1 py-1">
          <Show
            when={attachmentsQuery.isReady}
            fallback={
              <div class="text-text-secondary flex h-16 items-center justify-center text-xs">
                Loading…
              </div>
            }
          >
            <Show
              when={sortedAttachments().length > 0}
              fallback={
                <div class="text-text-secondary flex h-24 flex-col items-center justify-center gap-1 text-xs">
                  <span class="i-material-symbols:image-not-supported-outline size-6 opacity-40" />
                  <span>No attachments yet</span>
                </div>
              }
            >
              <For each={sortedAttachments()}>
                {(att) => (
                  <AttachmentRow att={att} onDelete={removeAttachment} onNavigate={navigate} />
                )}
              </For>
            </Show>
          </Show>
        </div>
      </div>
      <Portal>
        <HoverCard.Positioner>
          <HoverCard.Content class={treeStyles.HoverCardContent}>
            <Suspense>
              <Show when={activePath()}>{(path) => <MemoPreview path={path()} />}</Show>
            </Suspense>
          </HoverCard.Content>
        </HoverCard.Positioner>
      </Portal>
    </HoverCard.Root>
  );
};
