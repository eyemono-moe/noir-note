import { createTreeCollection } from "@ark-ui/solid";
import { Show, type Component, createMemo } from "solid-js";

import type { MemoDocument } from "../../db/rxdb";
import type { MemosCollection } from "../../db/tanstack";
import { buildTree, type TreeNode } from "../../utils/tree";
import { Tree } from "./Tree";

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onDelete: (path: string) => void;
  visible: boolean;
  allMemos: MemoDocument[];
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
    <Show when={props.visible}>
      <div class="grid h-full w-64 grid-rows-[auto_1fr] border-r border-gray-200 bg-white">
        <div class="p-2 text-gray-700">Notes</div>
        <div class="overflow-auto p-2">
          <Show when={tree().length === 0}>
            <div class="px-4 py-8 text-center text-sm text-gray-500">No pages yet</div>
          </Show>
          <Tree
            collection={collection()}
            onNavigate={props.onNavigate}
            currentPath={props.currentPath}
            onDelete={props.onDelete}
            onInsert={(_parentPath) => {}}
            memosCollection={props.memosCollection}
            allMemos={props.allMemos}
          />
        </div>
      </div>
    </Show>
  );
};

export default Sidebar;
