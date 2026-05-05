import { HoverCard } from "@ark-ui/solid/hover-card";
import { TreeView, useTreeView, type TreeCollection } from "@ark-ui/solid/tree-view";
import { ReactiveSet } from "@solid-primitives/set";
import { createVirtualizer, type Virtualizer } from "@tanstack/solid-virtual";
import {
  batch,
  createMemo,
  createSignal,
  For,
  lazy,
  Match,
  onMount,
  Show,
  Suspense,
  Switch,
  type Component,
} from "solid-js";
import { Portal } from "solid-js/web";

import type { Memo, MemoWithoutContent } from "../../types/memo";
import { getParentPath } from "../../utils/path";
import { type TreeNode } from "../../utils/tree";
import ConfirmDialog from "./ConfirmDialog";

import styles from "./tree.module.css";

const MemoPreview = lazy(() => import("./MemoPreview"));

/**
 * Estimated row height in pixels — must match the CSS:
 * font-size 0.875rem (14px) + line-height 1.25rem (20px) +
 * padding-block 0.125rem × 2 (4px) = 24px.
 */
const ROW_HEIGHT = 24;

// ---------------------------------------------------------------------------
// Virtual row types
// ---------------------------------------------------------------------------

type NodeRow = { kind: "node"; node: TreeNode; indexPath: number[] };
type CreateInputRow = { kind: "create-input"; parentPath: string; depth: number };
type VirtualRow = NodeRow | CreateInputRow;

// ---------------------------------------------------------------------------
// CreateMemoInput
// ---------------------------------------------------------------------------

const CreateMemoInput: Component<{
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
      if (trimmed) props.onConfirm(trimmed);
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

// ---------------------------------------------------------------------------
// Tree
// ---------------------------------------------------------------------------

type TreeProps = {
  currentPath: string;
  onNavigate: (path: string) => void;
  onDelete: (path: string) => void;
  onInsert: (memo: Omit<Memo, "content" | "createdAt" | "updatedAt">) => void;
  collection: TreeCollection<TreeNode>;
  allMemos: MemoWithoutContent[];
};

export const Tree: Component<TreeProps> = (props) => {
  // oxlint-disable-next-line no-unassigned-vars --- needed for ref
  let treeRef: HTMLDivElement | undefined;
  let virtualizerRef: Virtualizer<HTMLDivElement, Element> | undefined;

  const [deleteConfirmState, setDeleteConfirmState] = createSignal<{
    path: string;
    name: string;
  } | null>(null);

  const [creatingState, setCreatingState] = createSignal<{
    parentPath: string;
    inputValue: string;
  } | null>(null);

  const [activePath, setActivePath] = createSignal<string | null>(null);

  // [TODO] Persist expanded state across sessions.
  const expandedPaths = new ReactiveSet<string>([]);

  // "/" root is always kept expanded.
  const effectiveExpandedPaths = createMemo((): string[] => {
    expandedPaths.add("/");
    return Array.from(expandedPaths);
  });

  // Use getter-based props so reactive dependencies (collection, selectedValue,
  // expandedValue) are tracked by Ark UI's internal createMemo.
  const tree = useTreeView({
    get collection() {
      return props.collection;
    },
    get selectedValue() {
      return [props.currentPath];
    },
    get expandedValue() {
      return effectiveExpandedPaths();
    },
    onExpandedChange: (details) => {
      batch(() => {
        expandedPaths.clear();
        for (const path of details.expandedValue) {
          expandedPaths.add(path);
        }
      });
    },
    onSelectionChange: (details) => {
      const node = details.selectedNodes[0];
      if (node) props.onNavigate(node.path);
    },
    scrollToIndexFn: (details) => {
      virtualizerRef?.scrollToIndex(details.index, { align: "auto" });
    },
  });

  const visibleNodes = () => tree().getVisibleNodes();

  /**
   * Flat virtual row list.
   * When a new note is being named, a create-input row is injected right after
   * the parent node (appearing as the first child in the expanded parent).
   */
  const virtualRows = createMemo((): VirtualRow[] => {
    const nodes = visibleNodes();
    const creating = creatingState();

    if (!creating) {
      return nodes.map((n) => ({ kind: "node", node: n.node, indexPath: n.indexPath }));
    }

    const parentIdx = nodes.findIndex((n) => n.node.path === creating.parentPath);
    if (parentIdx === -1) {
      // Parent not visible — show nodes without the input row.
      return nodes.map((n) => ({ kind: "node", node: n.node, indexPath: n.indexPath }));
    }

    // Compute the CSS --depth value for the input row.
    // NodeProvider doesn't set --depth; we set it as an inline style.
    // The CSS uses --depth (1-indexed), so depth = parentNodeState.depth + 1.
    // The create-input is one level deeper than its parent, so depth = parent + 2.
    const parentNodeState = tree().getNodeState({
      node: nodes[parentIdx].node,
      indexPath: nodes[parentIdx].indexPath,
    });
    const inputDepth = parentNodeState.depth + 2;

    const result: VirtualRow[] = [];
    for (let i = 0; i < nodes.length; i++) {
      result.push({ kind: "node", node: nodes[i].node, indexPath: nodes[i].indexPath });
      if (i === parentIdx) {
        result.push({ kind: "create-input", parentPath: creating.parentPath, depth: inputDepth });
      }
    }
    return result;
  });

  const virtualizer = createVirtualizer<HTMLDivElement, Element>({
    get count() {
      return virtualRows().length;
    },
    getScrollElement: () => treeRef ?? null,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  // Expose so scrollToIndexFn can call it.
  virtualizerRef = virtualizer;

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  const handleDeleteConfirm = (path: string) => {
    props.onDelete(path);
    props.onNavigate(getParentPath(path) ?? "/");
    setDeleteConfirmState(null);
  };

  const handleCreateConfirm = (parentPath: string, name: string) => {
    const newPath = parentPath === "/" ? `/${name}` : `${parentPath}/${name}`;

    if (props.allMemos.some((memo) => memo.path === newPath)) {
      console.error("Path already exists:", newPath);
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      console.error("Invalid name: use only letters, numbers, _ and -");
      return;
    }
    if (name.length > 100) {
      console.error("Name too long (max 100 characters)");
      return;
    }

    try {
      props.onInsert({ path: newPath, metadata: undefined });
      props.onNavigate(newPath);
      setCreatingState(null);
    } catch (error) {
      console.error("Failed to create memo:", error);
    }
  };

  const handleAddChild = (node: TreeNode) => {
    expandedPaths.add(node.path);
    setCreatingState({ parentPath: node.path, inputValue: "" });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <HoverCard.Root
        lazyMount
        unmountOnExit
        openDelay={600}
        closeDelay={200}
        positioning={{ placement: "right-start", offset: { mainAxis: 8, crossAxis: 0 } }}
        onTriggerValueChange={(e) => setActivePath(e.value)}
      >
        <TreeView.RootProvider value={tree} class={styles.Root}>
          <TreeView.Tree ref={treeRef} class={styles.Tree}>
            <div
              style={{
                "min-height": `${virtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              <For each={virtualizer.getVirtualItems()}>
                {(virtualItem) => {
                  const row = () => virtualRows().at(virtualItem.index);

                  return (
                    <div
                      data-index={virtualItem.index}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      <Switch>
                        <Match when={row()?.kind === "create-input"}>
                          <div style={{ "--depth": String((row() as CreateInputRow).depth) }}>
                            <CreateMemoInput
                              onConfirm={(name) =>
                                handleCreateConfirm((row() as CreateInputRow).parentPath, name)
                              }
                              onCancel={() => setCreatingState(null)}
                            />
                          </div>
                        </Match>

                        <Match when={row()?.kind === "node"}>
                          {(_) => {
                            const nodeState = () =>
                              tree().getNodeState({
                                node: (row() as NodeRow).node,
                                indexPath: (row() as NodeRow).indexPath,
                              });

                            return (
                              <TreeView.NodeProvider
                                node={(row() as NodeRow).node}
                                indexPath={(row() as NodeRow).indexPath}
                              >
                                {/*
                                 * Use TreeView.BranchControl for all nodes (branches and
                                 * leaves alike), matching the original non-virtual tree.
                                 * TreeView.NodeProvider does NOT set the --depth CSS var
                                 * (only TreeView.Branch did); set it via inline style so
                                 * the CSS indentation calculations work correctly.
                                 * --depth is 1-indexed: root-level nodes → depth+1 = 1.
                                 */}
                                <HoverCard.Trigger
                                  value={(row() as NodeRow).node.path}
                                  asChild={(hoverProps) => (
                                    <TreeView.BranchControl
                                      class={styles.BranchControl}
                                      {...hoverProps()}
                                      style={{
                                        "--depth": String(nodeState().depth + 1),
                                      }}
                                    >
                                      <Show
                                        when={nodeState().isBranch}
                                        fallback={
                                          // Leaf: empty spacer keeps icon column aligned.
                                          <span class="size-4 shrink-0" />
                                        }
                                      >
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
                                        <span class="w-full truncate">
                                          {(row() as NodeRow).node.name}
                                        </span>
                                      </TreeView.BranchText>

                                      <div class={styles.ActionGroup}>
                                        <Show when={!nodeState().isBranch}>
                                          <button
                                            class={styles.Action}
                                            type="button"
                                            aria-label="Delete note"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDeleteConfirmState({
                                                path: (row() as NodeRow).node.path,
                                                name: (row() as NodeRow).node.name,
                                              });
                                            }}
                                          >
                                            <span class="i-material-symbols:delete-rounded size-4 shrink-0" />
                                          </button>
                                        </Show>
                                        <button
                                          class={styles.Action}
                                          type="button"
                                          aria-label="Add child note"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleAddChild((row() as NodeRow).node);
                                          }}
                                        >
                                          <span class="i-material-symbols:add-rounded size-4 shrink-0" />
                                        </button>
                                      </div>
                                    </TreeView.BranchControl>
                                  )}
                                />
                              </TreeView.NodeProvider>
                            );
                          }}
                        </Match>
                      </Switch>
                    </div>
                  );
                }}
              </For>
            </div>
          </TreeView.Tree>
        </TreeView.RootProvider>

        <Portal>
          <HoverCard.Positioner>
            <HoverCard.Content class={styles.HoverCardContent}>
              <Suspense>
                <Show when={activePath()}>{(path) => <MemoPreview path={path()} />}</Show>
              </Suspense>
            </HoverCard.Content>
          </HoverCard.Positioner>
        </Portal>
      </HoverCard.Root>

      <Show when={deleteConfirmState()}>
        {(state) => (
          <ConfirmDialog
            open={true}
            title="Delete Note"
            description={`Are you sure you want to delete "${state().name}" (${state().path})?\nThis action cannot be undone.`}
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
