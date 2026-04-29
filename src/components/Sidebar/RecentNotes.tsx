import { HoverCard } from "@ark-ui/solid/hover-card";
import { For, Show, Suspense, createSignal, lazy, type Component } from "solid-js";
import { Portal } from "solid-js/web";

import type { MemoWithoutContent } from "../../types/memo";

import treeStyles from "./tree.module.css";

const MemoPreview = lazy(() => import("./MemoPreview"));

interface RecentNotesProps {
  allMemos: MemoWithoutContent[];
  currentPath: string;
  onNavigate: (path: string) => void;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function getMemoDisplayName(path: string, title?: string | null): string {
  if (title) return title;
  const segments = path.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? "/";
}

export const RecentNotes: Component<RecentNotesProps> = (props) => {
  const [activePath, setActivePath] = createSignal<string | null>(null);

  const sortedMemos = () =>
    [...props.allMemos].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 20);

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
        <For
          each={sortedMemos()}
          fallback={
            <div class="text-text-secondary px-4 py-8 text-center text-sm">No recent notes</div>
          }
        >
          {(memo) => (
            <HoverCard.Trigger
              value={memo.path}
              asChild={(hoverProps) => (
                <button
                  type="button"
                  class={`focus-ring text-text-primary flex w-full cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent px-2 py-1 text-start text-sm leading-5 select-none hover:bg-surface-transparent-hover${memo.path === props.currentPath ? " bg-surface-transparent-active" : ""}`}
                  onClick={() => props.onNavigate(memo.path)}
                  {...hoverProps()}
                >
                  <span class="i-material-symbols:description-outline-rounded size-4 shrink-0" />
                  <span class="flex-1 truncate">
                    {getMemoDisplayName(memo.path, memo.metadata?.title)}
                  </span>
                  <span class="text-text-secondary shrink-0 text-xs leading-4 whitespace-nowrap">
                    {formatRelativeTime(memo.updatedAt)}
                  </span>
                </button>
              )}
            />
          )}
        </For>
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
