import { HoverCard } from "@ark-ui/solid/hover-card";
import { For, Suspense, lazy, type Component } from "solid-js";
import { Portal } from "solid-js/web";

import type { MemoWithoutContent } from "../../types/memo";

import styles from "./sidebar.module.css";
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
  const sortedMemos = () =>
    [...props.allMemos].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 20);

  return (
    <div class={styles.ListContainer}>
      <For
        each={sortedMemos()}
        fallback={
          <div class="text-text-secondary px-4 py-8 text-center text-sm">No recent notes</div>
        }
      >
        {(memo) => (
          <HoverCard.Root
            lazyMount
            unmountOnExit
            openDelay={600}
            closeDelay={200}
            positioning={{ placement: "right-start", offset: { mainAxis: 8, crossAxis: 0 } }}
          >
            <HoverCard.Trigger
              asChild={(hoverProps) => (
                <button
                  type="button"
                  class={styles.ListItem}
                  classList={{ [styles.ListItemActive]: memo.path === props.currentPath }}
                  onClick={() => props.onNavigate(memo.path)}
                  {...hoverProps()}
                >
                  <span class="i-material-symbols:description-outline-rounded size-4 shrink-0" />
                  <span class={styles.ListItemName}>
                    {getMemoDisplayName(memo.path, memo.metadata?.title)}
                  </span>
                  <span class={styles.ListItemMeta}>{formatRelativeTime(memo.updatedAt)}</span>
                </button>
              )}
            />
            <Portal>
              <HoverCard.Positioner>
                <HoverCard.Content class={treeStyles.HoverCardContent}>
                  <Suspense>
                    <MemoPreview path={memo.path} />
                  </Suspense>
                </HoverCard.Content>
              </HoverCard.Positioner>
            </Portal>
          </HoverCard.Root>
        )}
      </For>
    </div>
  );
};
