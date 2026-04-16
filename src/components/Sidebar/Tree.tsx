import { TreeView, useTreeViewContext, type TreeCollection } from "@ark-ui/solid";
import { For, Show, type Component } from "solid-js";

import { type TreeNode } from "../../utils/tree";

import styles from "./tree.module.css";

interface TreeNodeProps extends TreeView.NodeProviderProps<TreeNode> {
  onRemove?: (props: TreeView.NodeProviderProps<TreeNode>) => void;
  onAdd?: (props: TreeView.NodeProviderProps<TreeNode>) => void;
}

const TreeItemActions: Component<TreeNodeProps> = (props) => {
  const tree = useTreeViewContext();
  const isBranch = () => tree().collection.isBranchNode(props.node);
  return (
    <div class={styles.ActionGroup}>
      <Show when={!isBranch()}>
        <button
          class={styles.Action}
          onClick={(e) => {
            e.stopPropagation();
            props.onRemove?.(props);
          }}
        >
          <span class="i-material-symbols:delete-rounded size-4 shrink-0" />
        </button>
      </Show>
      <Show when={isBranch()}>
        <button
          class={styles.Action}
          onClick={(e) => {
            e.stopPropagation();
            props.onAdd?.(props);
          }}
        >
          <span class="i-material-symbols:add-rounded size-4 shrink-0" />
        </button>
      </Show>
    </div>
  );
};

const TreeItem: Component<TreeNodeProps> = (props) => {
  return (
    <TreeView.NodeProvider node={props.node} indexPath={props.indexPath}>
      <TreeView.NodeContext>
        {(nodeState) => (
          <Show
            when={nodeState().isBranch}
            fallback={
              <TreeView.Item class={styles.Item}>
                <TreeView.ItemText class={styles.ItemText}>
                  <span class="i-material-symbols:description-rounded size-4 shrink-0" />
                  {props.node.name}
                </TreeView.ItemText>
                <TreeItemActions
                  node={props.node}
                  indexPath={props.indexPath}
                  onAdd={props.onAdd}
                  onRemove={props.onRemove}
                />
              </TreeView.Item>
            }
          >
            <TreeView.Branch class={styles.Branch}>
              <TreeView.BranchControl class={styles.BranchControl}>
                <TreeView.BranchIndicator class={styles.BranchIndicator}>
                  <span class="i-material-symbols:chevron-right-rounded size-4 shrink-0" />
                </TreeView.BranchIndicator>
                <TreeView.BranchText class={styles.BranchText}>
                  <span
                    class={`size-4 shrink-0 ${nodeState().expanded ? "i-material-symbols:folder-open" : "i-material-symbols:folder"}`}
                  />
                  {props.node.name}
                </TreeView.BranchText>
                <TreeItemActions
                  node={props.node}
                  indexPath={props.indexPath}
                  onAdd={props.onAdd}
                  onRemove={props.onRemove}
                />
              </TreeView.BranchControl>
              <TreeView.BranchContent class={styles.BranchContent}>
                <TreeView.BranchIndentGuide class={styles.BranchIndentGuide} />
                <For each={props.node.children}>
                  {(child, index) => (
                    <TreeItem
                      node={child}
                      indexPath={[...props.indexPath, index()]}
                      onAdd={props.onAdd}
                      onRemove={props.onRemove}
                    />
                  )}
                </For>
              </TreeView.BranchContent>
            </TreeView.Branch>
          </Show>
        )}
      </TreeView.NodeContext>
    </TreeView.NodeProvider>
  );
};

type TreeProps = {
  currentPath: string;
  onNavigate: (path: string) => void;
  onDelete: (path: string) => void;
  onInsert: (parentPath: string) => void;
  collection: TreeCollection<TreeNode>;
};

export const Tree: Component<TreeProps> = (props) => {
  return (
    <TreeView.Root
      collection={props.collection}
      class={styles.Root}
      onSelectionChange={(details) => {
        props.onNavigate(details.selectedNodes[0].path);
      }}
    >
      <TreeView.Label class={styles.Label}>Notes</TreeView.Label>
      <TreeView.Tree class={styles.Tree}>
        <For each={props.collection.rootNode.children}>
          {(node, index) => (
            <TreeItem
              node={node}
              indexPath={[index()]}
              onAdd={(e) => props.onInsert(e.node.path)}
              onRemove={(e) => props.onDelete(e.node.path)}
            />
          )}
        </For>
      </TreeView.Tree>
    </TreeView.Root>
  );
};
