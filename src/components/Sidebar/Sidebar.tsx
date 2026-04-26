import { createTreeCollection } from "@ark-ui/solid";
import { Accordion } from "@ark-ui/solid/accordion";
import { createMemo, Show, type Component } from "solid-js";

import type { MemosCollection } from "../../db/tanstack";
import { updateSidebarAccordionState, useSidebarAccordionState } from "../../store/configStore";
import type { Memo, MemoWithoutContent } from "../../types/memo";
import { buildTree, type TreeNode } from "../../utils/tree";
import { Outline } from "./Outline";
import { RecentNotes } from "./RecentNotes";
import { Tree } from "./Tree";

import styles from "./sidebar.module.css";

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onDelete: (path: string) => void;
  onInsert: (memo: Omit<Memo, "content" | "createdAt" | "updatedAt">) => void;
  allMemos: MemoWithoutContent[];
  memosCollection: MemosCollection;
}

const Sidebar: Component<SidebarProps> = (props) => {
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
      class={styles.Root}
      multiple
      collapsible
      lazyMount
      value={accordionState()}
      onValueChange={(details) => updateSidebarAccordionState(details.value)}
    >
      <Accordion.Item class={styles.Item} value="explorer">
        <Accordion.ItemTrigger class={styles.ItemTrigger}>
          <span>Explorer</span>
          <Accordion.ItemIndicator class={styles.ItemIndicator}>
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

      <Accordion.Item class={styles.Item} value="recent">
        <Accordion.ItemTrigger class={styles.ItemTrigger}>
          <span>Recent</span>
          <Accordion.ItemIndicator class={styles.ItemIndicator}>
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

      <Accordion.Item class={styles.Item} value="outline">
        <Accordion.ItemTrigger class={styles.ItemTrigger}>
          <span>Outline</span>
          <Accordion.ItemIndicator class={styles.ItemIndicator}>
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

export default Sidebar;
