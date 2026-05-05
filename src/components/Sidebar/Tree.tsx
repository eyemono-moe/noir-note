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
  onMount,
  Show,
  Suspense,
  Switch,
  Match,
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
 * Estimated row height in pixels.
 * Must match the CSS: font-size 0.875rem (14px) + line-height 1.25rem (20px) +
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

  const tree = useTreeView(() => ({
    collection: props.collection,
    selectedValue: [props.currentPath],
    expandedValue: effectiveExpandedPaths(),
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
  }));

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
      // Parent not visible — render without the input row.
      return nodes.map((n) => ({ kind: "node", node: n.node, indexPath: n.indexPath }));
    }

    // Compute depth so CreateInputContainer can calculate its indentation.
    // The CSS uses --depth inherited from the parent NodeProvider (1-indexed):
    //   depth = parentNodeState.depth + 1  (parentNodeState.depth is 0-indexed)
    const parentNodeState = tree().getNodeState({
      node: nodes[parentIdx].node,
      indexPath: nodes[parentIdx].indexPath,
    });
    const inputDepth = parentNodeState.depth + 1;

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

  // Expose the virtualizer so scrollToIndexFn can call it.
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

    // Reject duplicate paths.
    if (props.allMemos.some((memo) => memo.path === newPath)) {
      console.error("Path already exists:", newPath);
      return;
    }

    // Only alphanumerics, hyphens, underscores.
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
                  const row = () => virtualRows()[virtualItem.index];

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
                        <Match when={row().kind === "create-input" && (row() as CreateInputRow)}>
                          {(r) => (
                            <div style={{ "--depth": String(r().depth) }}>
                              <CreateMemoInput
                                onConfirm={(name) => handleCreateConfirm(r().parentPath, name)}
                                onCancel={() => setCreatingState(null)}
                              />
                            </div>
                          )}
                        </Match>

                        <Match when={row().kind === "node" && (row() as NodeRow)}>
                          {(r) => {
                            const nodeState = () =>
                              tree().getNodeState({
                                node: r().node,
                                indexPath: r().indexPath,
                              });

                            return (
                              <TreeView.NodeProvider node={r().node} indexPath={r().indexPath}>
                                <Show
                                  when={nodeState().isBranch}
                                  fallback={
                                    // Leaf node (file / note)
                                    <HoverCard.Trigger
                                      value={r().node.path}
                                      asChild={(hoverProps) => (
                                        <TreeView.Item
                                          class={styles.BranchControl}
                                          {...hoverProps()}
                                        >
                                          {/* Placeholder so icon column aligns with branches */}
                                          <span class="size-4 shrink-0" />
                                          <TreeView.ItemText class={styles.BranchText}>
                                            <span class="i-material-symbols:description-outline-rounded size-4 shrink-0" />
                                            <span class="w-full truncate">{r().node.name}</span>
                                          </TreeView.ItemText>
                                          <div class={styles.ActionGroup}>
                                            <button
                                              class={styles.Action}
                                              type="button"
                                              aria-label="Delete note"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteConfirmState({
                                                  path: r().node.path,
                                                  name: r().node.name,
                                                });
                                              }}
                                            >
                                              <span class="i-material-symbols:delete-rounded size-4 shrink-0" />
                                            </button>
                                            <button
                                              class={styles.Action}
                                              type="button"
                                              aria-label="Add child note"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleAddChild(r().node);
                                              }}
                                            >
                                              <span class="i-material-symbols:add-rounded size-4 shrink-0" />
                                            </button>
                                          </div>
                                        </TreeView.Item>
                                      )}
                                    />
                                  }
                                >
                                  {/* Branch node (folder) */}
                                  <HoverCard.Trigger
                                    value={r().node.path}
                                    asChild={(hoverProps) => (
                                      <TreeView.BranchControl
                                        class={styles.BranchControl}
                                        {...hoverProps()}
                                      >
                                        <TreeView.BranchIndicator class={styles.BranchIndicator}>
                                          <span class="i-material-symbols:chevron-right-rounded size-4 shrink-0" />
                                        </TreeView.BranchIndicator>
                                        <TreeView.BranchText class={styles.BranchText}>
                                          <span
                                            class={`size-4 shrink-0 ${nodeState().expanded ? "i-material-symbols:folder-open" : "i-material-symbols:folder"}`}
                                          />
                                          <span class="w-full truncate">{r().node.name}</span>
                                        </TreeView.BranchText>
                                        <div class={styles.ActionGroup}>
                                          <button
                                            class={styles.Action}
                                            type="button"
                                            aria-label="Add child note"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleAddChild(r().node);
                                            }}
                                          >
                                            <span class="i-material-symbols:add-rounded size-4 shrink-0" />
                                          </button>
                                        </div>
                                      </TreeView.BranchControl>
                                    )}
                                  />
                                </Show>
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
