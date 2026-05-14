import { HoverCard } from "@ark-ui/solid/hover-card";
import { type Component, For, Show, Suspense, createResource, createSignal, lazy } from "solid-js";
import { Portal } from "solid-js/web";

import { queryMemoPathsReferencingMemo } from "../../db/memoCollection";
import type { MemoWithoutContent } from "../../types/memo";

import treeStyles from "./tree.module.css";

const MemoPreview = lazy(() => import("./MemoPreview"));

interface BacklinkListProps {
  paths: string[];
  allMemos: MemoWithoutContent[];
  onNavigate: (path: string) => void;
  emptyMessage?: string;
}

interface BacklinksProps {
  currentPath: string;
  allMemos: MemoWithoutContent[];
  onNavigate: (path: string) => void;
}

function getMemoDisplayName(path: string, allMemos: MemoWithoutContent[]): string {
  const memo = allMemos.find((m) => m.path === path);
  if (memo?.metadata?.title) return memo.metadata.title;
  const segments = path.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? path;
}

export const BacklinkList: Component<BacklinkListProps> = (props) => {
  const [activePath, setActivePath] = createSignal<string | null>(null);

  return (
    <HoverCard.Root
      lazyMount
      unmountOnExit
      openDelay={600}
      closeDelay={200}
      positioning={{ placement: "right-start", offset: { mainAxis: 8, crossAxis: 0 } }}
      onTriggerValueChange={(e) => setActivePath(e.value)}
    >
      <div class="flex flex-col gap-0.5 p-1">
        <Show
          when={props.paths.length > 0}
          fallback={
            <div class="text-text-secondary px-4 py-8 text-center text-sm">
              {props.emptyMessage ?? "No backlinks"}
            </div>
          }
        >
          <For each={props.paths}>
            {(path) => (
              <HoverCard.Trigger
                value={path}
                asChild={(hoverProps) => (
                  <button
                    {...hoverProps()}
                    type="button"
                    class="focus-ring text-text-primary hover:bg-surface-transparent-hover flex w-full cursor-pointer items-start gap-1.5 rounded-md border-0 bg-transparent px-2 py-1 text-start text-sm leading-5 select-none"
                    onClick={() => props.onNavigate(path)}
                  >
                    <span class="text-text-secondary i-material-symbols:link-rounded mt-0.5 size-4 shrink-0" />
                    <span class="min-w-0 flex-1">
                      <span class="block truncate">{getMemoDisplayName(path, props.allMemos)}</span>
                      <span class="text-text-secondary block truncate text-xs">{path}</span>
                    </span>
                  </button>
                )}
              />
            )}
          </For>
        </Show>
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

export const Backlinks: Component<BacklinksProps> = (props) => {
  // Re-query whenever currentPath changes or any memo updatedAt changes.
  // Using path + max(updatedAt) as a coarse cache key keeps the backlinks
  // list fresh after edits without subscribing to every memo.
  const source = () => {
    const memos = props.allMemos;
    let maxUpdated = 0;
    for (const m of memos) {
      if (m.updatedAt > maxUpdated) maxUpdated = m.updatedAt;
    }
    return { path: props.currentPath, key: `${memos.length}:${maxUpdated}` };
  };

  const [refs] = createResource<string[], { path: string; key: string }>(
    source,
    (s) => queryMemoPathsReferencingMemo(s.path),
    { initialValue: [] },
  );

  return (
    <BacklinkList
      paths={refs.latest ?? []}
      allMemos={props.allMemos}
      onNavigate={props.onNavigate}
    />
  );
};
