import { TreeView, useTreeViewContext, type TreeCollection } from "@ark-ui/solid";
import { ReactiveSet } from "@solid-primitives/set";
import {
  batch,
  createMemo,
  createSignal,
  For,
  onMount,
  Show,
  type Accessor,
  type Component,
} from "solid-js";

import type { MemoDocument } from "../../db/rxdb";
import { type MemosCollection } from "../../db/tanstack";
import { getParentPath } from "../../utils/path";
import { type TreeNode } from "../../utils/tree";
import ConfirmDialog from "./ConfirmDialog";

import styles from "./tree.module.css";

interface TreeNodeProps extends TreeView.NodeProviderProps<TreeNode> {
  onRemove?: (props: TreeView.NodeProviderProps<TreeNode>) => void;
  onAdd?: (props: TreeView.NodeProviderProps<TreeNode>) => void;
  creatingState?: Accessor<{ parentPath: string; inputValue: string } | null>;
  onCreateConfirm?: (parentPath: string, name: string) => void;
  onCreateCancel?: () => void;
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
          type="button"
          aria-label="Delete note"
        >
          <span class="i-material-symbols:delete-rounded size-4 shrink-0" />
        </button>
      </Show>
      <button
        class={styles.Action}
        onClick={(e) => {
          e.stopPropagation();
          props.onAdd?.(props);
        }}
        type="button"
        aria-label="Add child note"
      >
        <span class="i-material-symbols:add-rounded size-4 shrink-0" />
      </button>
    </div>
  );
};

const CreateMemoInput: Component<{
  parentPath: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}> = (props) => {
  const [value, setValue] = createSignal("");
  // oxlint-disable-next-line no-unassigned-vars --- needed for ref
  let inputRef: HTMLInputElement | undefined;

  onMount(() => {
    inputRef?.focus();
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = value().trim();
      if (trimmed) {
        props.onConfirm(trimmed);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      props.onCancel();
    }
  };

  return (
    <div class={styles.CreateInputContainer}>
      <span class="i-material-symbols:draft-outline-rounded size-4 shrink-0" />
      <input
        ref={inputRef}
        class={styles.NodeRenameInput}
        value={value()}
        onInput={(e) => setValue(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => props.onCancel()}
        placeholder="Enter note name..."
      />
    </div>
  );
};

const TreeItem: Component<TreeNodeProps> = (props) => {
  return (
    <TreeView.NodeProvider node={props.node} indexPath={props.indexPath}>
      <TreeView.NodeContext>
        {(nodeState) => (
          <TreeView.Branch class={styles.Branch}>
            <TreeView.BranchControl class={styles.BranchControl}>
              <Show when={nodeState().isBranch} fallback={<span class="size-4 shrink-0" />}>
                <TreeView.BranchIndicator class={styles.BranchIndicator}>
                  <span class="i-material-symbols:chevron-right-rounded size-4 shrink-0" />
                </TreeView.BranchIndicator>
              </Show>
              <TreeView.BranchText class={styles.BranchText}>
                <Show
                  when={nodeState().isBranch}
                  fallback={
                    <span class="i-material-symbols:description-outline-rounded size-4 shrink-0" />
                  }
                >
                  <span
                    class={`size-4 shrink-0 ${nodeState().expanded ? "i-material-symbols:folder-open" : "i-material-symbols:folder"}`}
                  />
                </Show>
                <span class="truncate">{props.node.name}</span>
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

              {/* 作成中のinput表示 */}
              <Show when={props.creatingState?.()?.parentPath === props.node.path}>
                <CreateMemoInput
                  parentPath={props.node.path}
                  onConfirm={(name) => props.onCreateConfirm?.(props.node.path, name)}
                  onCancel={() => props.onCreateCancel?.()}
                />
              </Show>

              <For each={props.node.children}>
                {(child, index) => (
                  <TreeItem
                    node={child}
                    indexPath={[...props.indexPath, index()]}
                    onAdd={props.onAdd}
                    onRemove={props.onRemove}
                    creatingState={props.creatingState}
                    onCreateConfirm={props.onCreateConfirm}
                    onCreateCancel={props.onCreateCancel}
                  />
                )}
              </For>
            </TreeView.BranchContent>
          </TreeView.Branch>
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
  memosCollection: MemosCollection;
  allMemos: MemoDocument[];
};

export const Tree: Component<TreeProps> = (props) => {
  const [deleteConfirmState, setDeleteConfirmState] = createSignal<{
    path: string;
    name: string;
  } | null>(null);

  const [creatingState, setCreatingState] = createSignal<{
    parentPath: string;
    inputValue: string;
  } | null>(null);

  const expandedPaths = new ReactiveSet<string>([]); // [TODO] 開閉状態の永続化

  // rootノード("/")は常に展開状態を維持
  const effectiveExpandedPaths = createMemo((): string[] => {
    expandedPaths.add("/"); // 常に"/"を展開状態にする
    return Array.from(expandedPaths);
  });

  const handleDeleteConfirm = (path: string) => {
    // 既存の削除コールバック実行
    props.onDelete(path);

    // 親パスに遷移
    const parentPath = getParentPath(path) ?? "/";
    props.onNavigate(parentPath);

    // 状態クリア
    setDeleteConfirmState(null);
  };

  const handleCreateConfirm = (parentPath: string, name: string) => {
    const newPath = parentPath === "/" ? `/${name}` : `${parentPath}/${name}`;

    // バリデーション: 重複チェック
    const existingMemo = props.allMemos.find((memo) => memo.path === newPath);
    if (existingMemo) {
      console.error("Path already exists:", newPath);
      return;
    }

    // バリデーション: 無効文字チェック
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      console.error("Invalid name: use only letters, numbers, _ and -");
      return;
    }

    // バリデーション: 長さチェック
    if (name.length > 100) {
      console.error("Name too long (max 100 characters)");
      return;
    }

    // メモ作成
    const now = Date.now();
    try {
      props.memosCollection.insert({
        path: newPath,
        content: "",
        createdAt: now,
        updatedAt: now,
        metadata: undefined,
      });

      // 新規メモに遷移
      props.onNavigate(newPath);

      // 状態クリア
      setCreatingState(null);
    } catch (error) {
      console.error("Failed to create memo:", error);
    }
  };

  const handleCreateCancel = () => {
    setCreatingState(null);
  };

  return (
    <>
      <TreeView.Root
        collection={props.collection}
        class={styles.Root}
        selectedValue={[props.currentPath]}
        expandedValue={effectiveExpandedPaths()}
        onExpandedChange={(details) => {
          batch(() => {
            expandedPaths.clear();
            for (const path of details.expandedValue) {
              expandedPaths.add(path);
            }
          });
        }}
        onSelectionChange={(details) => {
          props.onNavigate(details.selectedNodes[0].path);
        }}
      >
        <TreeView.Tree class={styles.Tree}>
          <For each={props.collection.rootNode.children}>
            {(node, index) => (
              <TreeItem
                node={node}
                indexPath={[index()]}
                onAdd={(e) => {
                  // 親ノードを展開
                  const parentPath = e.node.path;
                  expandedPaths.add(parentPath);

                  setCreatingState({
                    parentPath: e.node.path,
                    inputValue: "",
                  });
                }}
                onRemove={(e) => {
                  setDeleteConfirmState({
                    path: e.node.path,
                    name: e.node.name,
                  });
                }}
                creatingState={creatingState}
                onCreateConfirm={handleCreateConfirm}
                onCreateCancel={handleCreateCancel}
              />
            )}
          </For>
        </TreeView.Tree>
      </TreeView.Root>

      <Show when={deleteConfirmState()}>
        {(state) => (
          <ConfirmDialog
            open={true}
            title="Delete Note"
            description={`Are you sure you want to delete "${state().name}" (${state().path})? This action cannot be undone.`}
            confirmLabel="Delete"
            cancelLabel="Cancel"
            variant="danger"
            onConfirm={() => handleDeleteConfirm(state().path)}
            onCancel={() => setDeleteConfirmState(null)}
          />
        )}
      </Show>
    </>
  );
};
