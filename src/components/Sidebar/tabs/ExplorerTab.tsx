import { createTreeCollection } from "@ark-ui/solid";
import { Accordion } from "@ark-ui/solid/accordion";
import { type Component, Show, createMemo } from "solid-js";

import type { MemosCollection } from "../../../db/memoCollection";
import { updateSidebarAccordionState, useSidebarAccordionState } from "../../../store/configStore";
import type { Memo, MemoWithoutContent } from "../../../types/memo";
import { buildTree, type TreeNode } from "../../../utils/tree";
import { Outline } from "../Outline";
import { RecentNotes } from "../RecentNotes";
import { Tree } from "../Tree";

import styles from "../sidebar.module.css";

interface ExplorerTabProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onDelete: (path: string) => void;
  onInsert: (memo: Omit<Memo, "content" | "createdAt" | "updatedAt">) => void;
  allMemos: MemoWithoutContent[];
  memosCollection: MemosCollection;
}

export const ExplorerTab: Component<ExplorerTabProps> = (props) => {
  const accordionState = useSidebarAccordionState();

  const tree = createMemo(() => buildTree(props.allMemos));

  const collection = createMemo(() =>
    createTreeCollection<TreeNode>({
      nodeToValue: (node) => node.path,
      nodeToString: (node) => node.name,
      rootNode: { name: "ROOT", path: "", children: tree() },
    }),
  );

  return (
    <Accordion.Root
      class="text-text-primary flex h-full w-full flex-col overflow-hidden"
      multiple
      collapsible
      lazyMount
      value={accordionState()}
      onValueChange={(details) => updateSidebarAccordionState(details.value)}
    >
      <Accordion.Item
        class="flex shrink-0 flex-col overflow-hidden data-[state=open]:min-h-0 data-[state=open]:flex-1"
        value="explorer"
      >
        <Accordion.ItemTrigger class="focus-ring text-text-secondary hover:bg-surface-transparent-hover hover:text-text-primary flex w-full shrink-0 cursor-pointer items-center justify-between bg-transparent px-3 py-1.5 text-[0.6875rem] font-bold tracking-[0.06em] uppercase select-none">
          <span>Explorer</span>
          <Accordion.ItemIndicator class="inline-flex items-center justify-center [transition:rotate_150ms_ease] data-[state=open]:[rotate:90deg]">
            <span class="i-material-symbols:chevron-right-rounded size-3.5 shrink-0" />
          </Accordion.ItemIndicator>
        </Accordion.ItemTrigger>
        <Accordion.ItemContent class={styles.ItemContent}>
          <Show when={tree().length === 0}>
            <div class="text-text-secondary px-4 py-8 text-center text-sm">No pages yet</div>
          </Show>
          <div class="p-1">
            <Tree
              collection={collection()}
              onNavigate={props.onNavigate}
              currentPath={props.currentPath}
              onDelete={props.onDelete}
              onInsert={props.onInsert}
              allMemos={props.allMemos}
            />
          </div>
        </Accordion.ItemContent>
      </Accordion.Item>

      <Accordion.Item
        class="flex shrink-0 flex-col overflow-hidden data-[state=open]:min-h-0 data-[state=open]:flex-1"
        value="recent"
      >
        <Accordion.ItemTrigger class="focus-ring text-text-secondary hover:bg-surface-transparent-hover hover:text-text-primary flex w-full shrink-0 cursor-pointer items-center justify-between bg-transparent px-3 py-1.5 text-[0.6875rem] font-bold tracking-[0.06em] uppercase select-none">
          <span>Recent</span>
          <Accordion.ItemIndicator class="inline-flex items-center justify-center [transition:rotate_150ms_ease] data-[state=open]:[rotate:90deg]">
            <span class="i-material-symbols:chevron-right-rounded size-3.5 shrink-0" />
          </Accordion.ItemIndicator>
        </Accordion.ItemTrigger>
        <Accordion.ItemContent class={styles.ItemContent}>
          <RecentNotes
            allMemos={props.allMemos}
            currentPath={props.currentPath}
            onNavigate={props.onNavigate}
          />
        </Accordion.ItemContent>
      </Accordion.Item>

      <Accordion.Item
        class="flex shrink-0 flex-col overflow-hidden data-[state=open]:min-h-0 data-[state=open]:flex-1"
        value="outline"
      >
        <Accordion.ItemTrigger class="focus-ring text-text-secondary hover:bg-surface-transparent-hover hover:text-text-primary flex w-full shrink-0 cursor-pointer items-center justify-between bg-transparent px-3 py-1.5 text-[0.6875rem] font-bold tracking-[0.06em] uppercase select-none">
          <span>Outline</span>
          <Accordion.ItemIndicator class="inline-flex items-center justify-center [transition:rotate_150ms_ease] data-[state=open]:[rotate:90deg]">
            <span class="i-material-symbols:chevron-right-rounded size-3.5 shrink-0" />
          </Accordion.ItemIndicator>
        </Accordion.ItemTrigger>
        <Accordion.ItemContent class={styles.ItemContent}>
          <Outline />
        </Accordion.ItemContent>
      </Accordion.Item>
    </Accordion.Root>
  );
};
