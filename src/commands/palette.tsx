import { Combobox, useListCollection } from "@ark-ui/solid/combobox";
import { Dialog } from "@ark-ui/solid/dialog";
import { createShortcut } from "@solid-primitives/keyboard";
import { createSignal, For, Show, type Component } from "solid-js";
import { Portal } from "solid-js/web";

import type { MemoDocument } from "../db/rxdb";
import type { MemosCollection } from "../db/tanstack";
import { commandRegistry } from "./registry";
import type { CommandContext, PaletteItem } from "./types";

import styles from "./palette.module.css";

interface CommandPaletteProps {
  context: CommandContext;
  allMemos: MemoDocument[];
  collection: MemosCollection;
}

const getItemIcon = (item: PaletteItem) => {
  if (item.type === "command") {
    return "i-material-symbols:bolt-rounded";
  }
  return "i-material-symbols:description-outline-rounded";
};

const CommandPalette: Component<CommandPaletteProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false);

  const { collection, filter } = useListCollection(() => {
    const items: PaletteItem[] = [];

    // Add commands
    for (const command of commandRegistry.getAll()) {
      items.push({
        type: "command",
        value: command.id,
        label: command.label,
        description: command.description,
        icon: "⚡",
        category: command.category,
      });
    }

    // Add pages (without content for performance)
    for (const page of props.allMemos) {
      // Use title from metadata, or extract from path (e.g., "/foo/bar" -> "bar")
      const pathParts = page.path.split("/").filter(Boolean);
      const defaultLabel = pathParts[pathParts.length - 1] || "Untitled";

      items.push({
        type: "page",
        value: page.path,
        label: page.metadata?.title || defaultLabel,
        description: page.path,
        icon: "📄",
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

  // Open palette with Cmd+K / Ctrl+K
  createShortcut(["Control", "K"], (e) => {
    e?.preventDefault();
    setIsOpen(true);
  });

  createShortcut(["Meta", "K"], (e) => {
    e?.preventDefault();
    setIsOpen(true);
  });

  // Handle item selection using onSelect (fires every time, even for same item)
  const handleSelect = async (details: { value: string[] }) => {
    const selectedValue = details.value[0];
    if (!selectedValue) return;

    const item = collection().find(selectedValue);
    if (!item) return;

    if (item.type === "command") {
      await commandRegistry.execute(item.value, props.context);
    } else if (item.type === "page") {
      props.context.navigate(item.value);
    }

    // Always close dialog after selection
    setIsOpen(false);
  };

  return (
    <Dialog.Root onOpenChange={({ open: o }) => setIsOpen(o)} open={isOpen()}>
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
