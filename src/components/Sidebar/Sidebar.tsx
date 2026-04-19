import { createTreeCollection } from "@ark-ui/solid";
import { Show, type Component, createMemo } from "solid-js";

import type { MemosCollection } from "../../db/tanstack";
import type { Memo, MemoWithoutContent } from "../../types/memo";
import { buildTree, type TreeNode } from "../../utils/tree";
import { Tree } from "./Tree";

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onDelete: (path: string) => void;
  onInsert: (memo: Omit<Memo, "content" | "createdAt" | "updatedAt">) => void;
  allMemos: MemoWithoutContent[];
  memosCollection: MemosCollection;
}

const Sidebar: Component<SidebarProps> = (props) => {
  const tree = createMemo(() => {
    return buildTree(props.allMemos);
  });

  const collection = createMemo(() =>
    createTreeCollection<TreeNode>({
      nodeToValue: (node) => node.path,
      nodeToString: (node) => node.name,
      rootNode: {
        name: "ROOT",
        path: "",
        children: tree(),
      },
    }),
  );

  return (
    <div class="bg-surface-primary grid h-full w-full grid-rows-[auto_1fr]">
      <div class="text-text-primary p-2">Notes</div>
      <div class="overflow-auto p-2">
        <Show when={tree().length === 0}>
          <div class="text-text-secondary px-4 py-8 text-center text-sm">No pages yet</div>
        </Show>
        <Tree
          collection={collection()}
          onNavigate={props.onNavigate}
          currentPath={props.currentPath}
          onDelete={props.onDelete}
          onInsert={props.onInsert}
          allMemos={props.allMemos}
        />
      </div>
    </div>
  );
};

export default Sidebar;
