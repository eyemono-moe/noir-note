import { Combobox, useListCollection } from "@ark-ui/solid/combobox";
import { Dialog } from "@ark-ui/solid/dialog";
import { useLiveQuery } from "@tanstack/solid-db";
import { formatForDisplay } from "@tanstack/solid-hotkeys";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Show,
  untrack,
  type Component,
} from "solid-js";
import { Portal } from "solid-js/web";

import {
  useCommandContext,
  useCommandExecution,
  useCommandPalette,
  useCommands,
} from "../context/commands";
import { useMemosCollection } from "../context/db";
import { getSearchClient } from "../search/searchClient";
import { buildPagePaletteItems, parseSearchQuery } from "./search";
import type { PageSearchResult, PaletteItem } from "./types";

import styles from "./palette.module.css";

/** Maximum number of items rendered in the palette list at once. */
const MAX_PALETTE_ITEMS = 50;

const getItemIcon = (item: PaletteItem) => {
  if (item.type === "command") {
    return "i-material-symbols:bolt-rounded";
  }
  return "i-material-symbols:description-outline-rounded";
};

const CommandPalette: Component = () => {
  // Get hooks from context
  const commands = useCommands();
  const commandContext = useCommandContext();
  const { executeCommand } = useCommandExecution();
  const { isOpen, setOpen } = useCommandPalette();

  const [inputValue, setInputValue] = createSignal("");
  const [workerResults, setWorkerResults] = createSignal<PageSearchResult[] | undefined>();

  // Get all memos for palette
  const memosCollection = useMemosCollection();
  const allMemosQuery = useLiveQuery((q) =>
    q.from({ memos: memosCollection }).select(({ memos }) => ({
      path: memos.path,
      content: memos.content,
      createdAt: memos.createdAt,
      updatedAt: memos.updatedAt,
      title: memos.metadata?.title,
      metadata: memos.metadata,
    })),
  );

  const { collection, filter, upsert, remove } = useListCollection(() => {
    const items: PaletteItem[] = [];

    // Add commands
    for (const command of commands()) {
      items.push({
        type: "command",
        value: command.id,
        label: command.label,
        description: command.description,
        shortcut: command.shortcut,
        category: command.category,
      });
    }

    return {
      initialItems: items,
      // Page items are ranked and prefiltered by searchPages before being upserted.
      // Keep commands searchable by label/description/value, ignoring tag:<tag> tokens.
      filter: (_itemText: string, filterText: string, item: PaletteItem) => {
        if (item.type === "page") {
          return true;
        }

        const { text, tags } = parseSearchQuery(filterText);
        if (tags.length > 0) {
          return false;
        }

        const lowerQuery = text.toLowerCase();
        return (
          item.label.toLowerCase().includes(lowerQuery) ||
          item.description?.toLowerCase().includes(lowerQuery) ||
          item.value.toLowerCase().includes(lowerQuery)
        );
      },
      groupBy: (item) => item.type,
    };
  });

  // Reset input value when dialog closes
  createEffect(() => {
    if (!isOpen()) {
      setInputValue("");
      filter("");
    }
  });

  // Keep the Worker index in sync with the reactive memo collection.
  createEffect(() => {
    const allMemos = allMemosQuery();
    if (!allMemos) return;

    const query = untrack(inputValue);
    void getSearchClient()
      .rebuild(allMemos)
      .then(() => {
        if (query.trim()) {
          return getSearchClient().search(query, { limit: MAX_PALETTE_ITEMS });
        }
        setWorkerResults(undefined);
        return undefined;
      })
      .then((results) => {
        if (results) setWorkerResults(results);
      })
      .catch((error: unknown) => {
        console.error("[CommandPalette] Search index update failed:", error);
        setWorkerResults(undefined);
      });
  });

  // Query the Worker when the palette input changes. Empty input still uses the
  // local memo list so existing pages show immediately before any search.
  createEffect(() => {
    const query = inputValue();
    if (!query.trim()) {
      setWorkerResults(undefined);
      return;
    }

    let cancelled = false;
    void getSearchClient()
      .search(query, { limit: MAX_PALETTE_ITEMS })
      .then((results) => {
        if (!cancelled) setWorkerResults(results);
      })
      .catch((error: unknown) => {
        console.error("[CommandPalette] Search query failed:", error);
        if (!cancelled) setWorkerResults(undefined);
      });

    return () => {
      cancelled = true;
    };
  });

  // Sync page in palette when memos or Worker results change.
  createEffect(() => {
    const allMemos = allMemosQuery();
    if (!allMemos) return;
    const pageItems = buildPagePaletteItems(
      allMemos,
      inputValue(),
      MAX_PALETTE_ITEMS,
      workerResults(),
    );
    untrack(() => {
      const existingPageItems = collection().items.filter((item) => item.type === "page");
      for (const item of existingPageItems) {
        remove(item.value);
      }

      for (const item of pageItems) {
        upsert(item.value, item);
      }
    });
  });

  // Slice groups so the list never renders more than MAX_PALETTE_ITEMS total.
  // Commands are shown first; remaining budget goes to page results.
  const displayGroups = createMemo((): [string, PaletteItem[]][] => {
    let remaining = MAX_PALETTE_ITEMS;
    return collection()
      .group()
      .flatMap(([type, items]) => {
        if (remaining <= 0) return [];
        const slice = items.slice(0, remaining);
        remaining -= slice.length;
        return slice.length > 0 ? [[type, slice] as [string, PaletteItem[]]] : [];
      });
  });

  // Handle item selection using onSelect (fires every time, even for same item)
  const handleSelect = async (details: { value: string[] }) => {
    const selectedValue = details.value[0];
    if (!selectedValue) return;

    const item = collection().find(selectedValue);
    if (!item) return;

    if (item.type === "command") {
      await executeCommand(item.value);
    } else if (item.type === "page") {
      commandContext().navigate(item.value);
    }

    // Always close dialog after selection
    setOpen(false);
  };

  return (
    <Dialog.Root onOpenChange={({ open: o }) => setOpen(o)} open={isOpen()}>
      <Portal>
        <Dialog.Backdrop class={styles.Backdrop} />
        <Dialog.Positioner class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-y-none pt-[10vh] [scrollbar-gutter:stable_both-edges]">
          <Dialog.Content class={styles.DialogContent}>
            <Combobox.Root
              collection={collection()}
              inputValue={inputValue()}
              onInputValueChange={({ inputValue }) => {
                setInputValue(inputValue);
                filter(inputValue);
              }}
              onSelect={handleSelect}
              class="isolate flex h-full min-h-0 flex-col"
              closeOnSelect={false}
              disableLayer
              inputBehavior="autohighlight"
              lazyMount
              loopFocus
              open
              unmountOnExit
            >
              <Combobox.Control class="border-border-primary relative flex items-center gap-3 border-b px-4 pt-4 pb-3.5">
                <span
                  aria-hidden
                  class="text-text-secondary i-material-symbols:search size-5 shrink-0"
                />
                <Combobox.Input
                  asChild={(props) => (
                    <input
                      {...props()}
                      class="text-text-primary placeholder:text-text-secondary min-w-0 flex-1 border-0 bg-transparent p-0 text-base leading-6 outline-none"
                      placeholder="Search for commands or pages..."
                    />
                  )}
                />
              </Combobox.Control>

              <Combobox.Content class={styles.Content}>
                <Show when={collection().items.length === 0}>
                  <Combobox.Empty>
                    <div class="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
                      <span class="i-material-symbols:search-off size-8 opacity-40" />
                      <p class="text-text-secondary m-0 text-sm">No results found</p>
                    </div>
                  </Combobox.Empty>
                </Show>

                <Combobox.List class="flex flex-col">
                  <For each={displayGroups()}>
                    {([type, group]) => (
                      <Combobox.ItemGroup class={styles.ItemGroup}>
                        <Combobox.ItemGroupLabel class="text-text-secondary px-3 py-1.5 text-xs leading-4 font-semibold tracking-[0.05em] uppercase select-none">
                          {type}
                        </Combobox.ItemGroupLabel>
                        <For each={group}>
                          {(item) => (
                            <Combobox.Item
                              item={item}
                              class="focus-ring hover:bg-surface-transparent-hover data-[highlighted]:bg-surface-transparent-hover active:bg-surface-transparent-active data-[state=checked]:bg-surface-transparent-active flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition-colors duration-100 outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
                            >
                              <span
                                class={`text-text-secondary size-[1.125rem] shrink-0 ${getItemIcon(item)}`}
                              />
                              <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                                <Combobox.ItemText class="text-text-primary truncate text-sm leading-5 font-medium">
                                  {item.label}
                                </Combobox.ItemText>
                                <Show when={item.description}>
                                  <span class="text-text-secondary truncate text-xs leading-4">
                                    {item.description}
                                  </span>
                                </Show>
                              </div>
                              <Show when={item.shortcut}>
                                <kbd class="border-border-primary bg-surface-secondary text-text-secondary shrink-0 rounded border px-1.5 py-0.5 font-mono text-xs leading-4 select-none">
                                  {formatForDisplay(item.shortcut!)}
                                </kbd>
                              </Show>
                            </Combobox.Item>
                          )}
                        </For>
                      </Combobox.ItemGroup>
                    )}
                  </For>
                </Combobox.List>
              </Combobox.Content>
            </Combobox.Root>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};

export default CommandPalette;
