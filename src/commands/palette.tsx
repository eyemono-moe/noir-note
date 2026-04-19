import { Combobox, useListCollection } from "@ark-ui/solid/combobox";
import { Dialog } from "@ark-ui/solid/dialog";
import { useLiveQuery } from "@tanstack/solid-db";
import { formatForDisplay } from "@tanstack/solid-hotkeys";
import { createEffect, For, Show, untrack, type Component } from "solid-js";
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

  // Get all memos for palette
  const memosCollectionResource = useMemosCollection();
  const allMemosQuery = useLiveQuery((q) => {
    const collection = memosCollectionResource();
    if (!collection) return null;
    return q.from({ memos: collection }).select(({ memos }) => ({
      path: memos.path,
      title: memos.metadata?.title,
      metadata: memos.metadata,
    }));
  });

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
        <Dialog.Positioner class={styles.Positioner}>
          <Dialog.Content class={styles.DialogContent}>
            <Combobox.Root
              collection={collection()}
              onInputValueChange={({ inputValue }) => filter(inputValue)}
              onSelect={handleSelect}
              class={styles.ComboboxRoot}
              closeOnSelect={false}
              disableLayer
              inputBehavior="autohighlight"
              lazyMount
              loopFocus
              open
              unmountOnExit
            >
              <Combobox.Control class={styles.Control}>
                <span aria-hidden class={`${styles.SearchIcon} i-material-symbols:search`} />
                <Combobox.Input
                  asChild={(props) => (
                    <input
                      {...props()}
                      class={styles.Input}
                      placeholder="Search for commands or pages..."
                    />
                  )}
                />
              </Combobox.Control>

              <Combobox.Content class={styles.Content}>
                <Show when={collection().items.length === 0}>
                  <Combobox.Empty>
                    <div class={styles.Empty}>
                      <span class="i-material-symbols:search-off size-8 opacity-40" />
                      <p class="text-text-secondary m-0 text-sm">No results found</p>
                    </div>
                  </Combobox.Empty>
                </Show>

                <Combobox.List class={styles.List}>
                  <For each={collection().group()}>
                    {([type, group]) => (
                      <Combobox.ItemGroup class={styles.ItemGroup}>
                        <Combobox.ItemGroupLabel class={styles.GroupLabel}>
                          {type}
                        </Combobox.ItemGroupLabel>
                        <For each={group}>
                          {(item) => (
                            <Combobox.Item item={item} class={styles.Item}>
                              <span class={`${styles.ItemIcon} ${getItemIcon(item)} shrink-0`} />
                              <div class={styles.ItemContent}>
                                <Combobox.ItemText class={styles.ItemLabel}>
                                  {item.label}
                                </Combobox.ItemText>
                                <Show when={item.description}>
                                  <span class={styles.ItemDescription}>{item.description}</span>
                                </Show>
                              </div>
                              <Show when={item.shortcut}>
                                <kbd class={styles.ItemShortcut}>
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
