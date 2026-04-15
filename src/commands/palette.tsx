import { Combobox, createListCollection } from "@ark-ui/solid/combobox";
import { createShortcut } from "@solid-primitives/keyboard";
import { createSignal, For, Show, type Component, createMemo } from "solid-js";

import type { MemoResource } from "../store/memoResource";
import { commandRegistry } from "./registry";
import { searchPages } from "./search";
import type { CommandContext, PaletteItem } from "./types";

interface CommandPaletteProps {
  context: CommandContext;
  memoResource: MemoResource;
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
      const memos = props.memoResource.memosArray();
      const pages = searchPages(memos, query);
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
        class="fixed inset-0 z-50 bg-black/50"
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
                class="w-full rounded-t border border-gray-300 bg-white px-4 py-3 text-base outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsOpen(false);
                    setInputValue("");
                  }
                }}
              />
            </Combobox.Control>

            <Combobox.Positioner>
              <Combobox.Content class="w-full overflow-hidden rounded-b border border-t-0 border-gray-300 bg-white shadow-lg">
                <Combobox.List class="max-h-96 overflow-y-auto">
                  <For each={paletteItems()}>
                    {(item) => (
                      <Combobox.Item
                        item={item}
                        class="cursor-pointer border-b border-gray-100 px-4 py-3 last:border-b-0 hover:bg-gray-100 data-[state=highlighted]:bg-gray-100"
                      >
                        <div class="flex items-start gap-3">
                          <span class="text-xl">{item.icon}</span>
                          <div class="min-w-0 flex-1">
                            <div class="text-sm font-medium text-black">{item.label}</div>
                            <Show when={item.description}>
                              <div class="text-xs text-gray-600">{item.description}</div>
                            </Show>
                            <Show when={item.preview}>
                              <div class="mt-1 truncate text-xs text-gray-500">{item.preview}</div>
                            </Show>
                          </div>
                          <Show when={item.type === "command" && item.category}>
                            <span class="text-xs text-gray-400 uppercase">{item.category}</span>
                          </Show>
                        </div>
                      </Combobox.Item>
                    )}
                  </For>
                </Combobox.List>

                <Show when={paletteItems().length === 0}>
                  <div class="px-4 py-8 text-center text-sm text-gray-500">
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
