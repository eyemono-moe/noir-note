import { Combobox, createListCollection } from "@ark-ui/solid/combobox";
import { createShortcut } from "@solid-primitives/keyboard";
import { createSignal, For, Show, type Component, createMemo } from "solid-js";

import type { MemoDocument } from "../db/rxdb";
import type { MemosCollection } from "../db/tanstack";
import { commandRegistry } from "./registry";
import { searchPages } from "./search";
import type { CommandContext, PaletteItem } from "./types";

interface CommandPaletteProps {
  context: CommandContext;
  allMemos: MemoDocument[];
  collection: MemosCollection;
}

const CommandPalette: Component<CommandPaletteProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false);
  const [inputValue, setInputValue] = createSignal("");

  // Build palette items from commands and pages
  const paletteItems = createMemo((): PaletteItem[] => {
    const query = inputValue().trim();
    const items: PaletteItem[] = [];

    // Add commands
    const commands = query ? commandRegistry.search(query) : commandRegistry.getAll();
    for (const command of commands) {
      items.push({
        type: "command",
        value: command.id,
        label: command.label,
        description: command.description,
        icon: "⚡",
        category: command.category,
      });
    }

    // Add pages (only if there's a query)
    if (query) {
      const pages = searchPages(props.allMemos, query);
      for (const page of pages) {
        items.push({
          type: "page",
          value: page.path,
          label: page.title,
          description: page.path,
          preview: page.preview,
          icon: "📄",
        });
      }
    }

    return items.slice(0, 10); // Limit to 10 results
  });

  // Create collection for Combobox
  const collection = createMemo(() =>
    createListCollection({
      items: paletteItems(),
    }),
  );

  // Open palette with Cmd+K / Ctrl+K
  createShortcut(["Control", "K"], (e) => {
    e?.preventDefault();
    setIsOpen(true);
  });

  createShortcut(["Meta", "K"], (e) => {
    e?.preventDefault();
    setIsOpen(true);
  });

  // Handle item selection
  const handleValueChange = async (details: { value: string[] }) => {
    const selectedValue = details.value[0];
    if (!selectedValue) return;

    const item = paletteItems().find((i) => i.value === selectedValue);
    if (!item) return;

    setIsOpen(false);
    setInputValue("");

    if (item.type === "command") {
      await commandRegistry.execute(item.value, props.context);
    } else if (item.type === "page") {
      props.context.navigate(item.value);
    }
  };

  return (
    <Show when={isOpen()}>
      {/* Backdrop */}
      <div
        class="bg-overlay fixed inset-0 z-50"
        onClick={() => setIsOpen(false)}
        role="presentation"
      />

      {/* Dialog */}
      <div class="pointer-events-none fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
        <div class="pointer-events-auto w-full max-w-2xl">
          <Combobox.Root
            collection={collection()}
            inputValue={inputValue()}
            onInputValueChange={(details) => setInputValue(details.inputValue)}
            onValueChange={handleValueChange}
            open={isOpen()}
            onOpenChange={(details) => {
              if (!details.open) {
                setIsOpen(false);
                setInputValue("");
              }
            }}
            closeOnSelect
          >
            <Combobox.Control class="relative">
              <Combobox.Input
                placeholder="Type a command or search pages..."
                class="border-border-primary bg-surface-primary text-text-primary w-full rounded-t border px-4 py-3 text-base outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsOpen(false);
                    setInputValue("");
                  }
                }}
              />
            </Combobox.Control>

            <Combobox.Positioner>
              <Combobox.Content class="border-border-primary bg-surface-primary w-full overflow-hidden rounded-b border border-t-0 shadow-lg">
                <Combobox.List class="max-h-96 overflow-y-auto">
                  <For each={paletteItems()}>
                    {(item) => (
                      <Combobox.Item
                        item={item}
                        class="border-border-secondary hover:bg-surface-hover data-[state=highlighted]:bg-surface-hover cursor-pointer border-b px-4 py-3 last:border-b-0"
                      >
                        <div class="flex items-start gap-3">
                          <span class="text-xl">{item.icon}</span>
                          <div class="min-w-0 flex-1">
                            <div class="text-text-primary text-sm font-medium">{item.label}</div>
                            <Show when={item.description}>
                              <div class="text-text-secondary text-xs">{item.description}</div>
                            </Show>
                            <Show when={item.preview}>
                              <div class="text-text-secondary mt-1 truncate text-xs">
                                {item.preview}
                              </div>
                            </Show>
                          </div>
                          <Show when={item.type === "command" && item.category}>
                            <span class="text-text-disabled text-xs uppercase">
                              {item.category}
                            </span>
                          </Show>
                        </div>
                      </Combobox.Item>
                    )}
                  </For>
                </Combobox.List>

                <Show when={paletteItems().length === 0}>
                  <div class="text-text-secondary px-4 py-8 text-center text-sm">
                    <Show when={inputValue().trim() === ""} fallback="No results found">
                      Type to search commands and pages
                    </Show>
                  </div>
                </Show>
              </Combobox.Content>
            </Combobox.Positioner>
          </Combobox.Root>
        </div>
      </div>
    </Show>
  );
};

export default CommandPalette;
