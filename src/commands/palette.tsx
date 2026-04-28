import { Combobox, useListCollection } from "@ark-ui/solid/combobox";
import { Dialog } from "@ark-ui/solid/dialog";
import { useLiveQuery } from "@tanstack/solid-db";
import { formatForDisplay } from "@tanstack/solid-hotkeys";
import { createEffect, createSignal, For, Show, untrack, type Component } from "solid-js";
import { Portal } from "solid-js/web";

import {
  useCommandContext,
  useCommandExecution,
  useCommandPalette,
  useCommands,
} from "../context/commands";
import { useMemosCollection } from "../context/db";
import { getPathSegments } from "../utils/path";
import type { PaletteItem } from "./types";

import styles from "./palette.module.css";

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

  // Get all memos for palette
  const memosCollection = useMemosCollection();
  const allMemosQuery = useLiveQuery((q) =>
    q.from({ memos: memosCollection }).select(({ memos }) => ({
      path: memos.path,
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
      // Custom filter that searches in label, description, and path
      filter: (_itemText: string, filterText: string, item: PaletteItem) => {
        const lowerQuery = filterText.toLowerCase();
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

  // Sync page in palette when memos change
  createEffect(() => {
    const allMemos = allMemosQuery();
    if (!allMemos) return;
    // Create a Set of current memo paths for efficient lookup
    const currentMemoPaths = new Set(allMemos.map((memo) => memo.path));
    untrack(() => {
      // Get all existing page items from collection
      const existingPageItems = collection().items.filter((item) => item.type === "page");
      console.log("Sync ", allMemos.length, existingPageItems.length);

      // Remove page items that no longer exist in memos
      for (const item of existingPageItems) {
        if (!currentMemoPaths.has(item.value)) {
          remove(item.value);
        }
      }

      // Upsert all current memos (updates existing, adds new)
      for (const memo of allMemos) {
        const pathParts = getPathSegments(memo.path);
        const defaultLabel = pathParts.at(-1) || "Untitled";
        console.log("upsert memos", memo.path);

        upsert(memo.path, {
          type: "page",
          value: memo.path,
          label: memo.metadata?.title || defaultLabel,
          description: memo.path,
        });
      }
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
                  <For each={collection().group()}>
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
