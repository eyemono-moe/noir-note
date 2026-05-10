import { Combobox, useListCollection } from "@ark-ui/solid/combobox";
import { Dialog } from "@ark-ui/solid/dialog";
import { createEffect, createSignal, For, Show, type Component } from "solid-js";
import { Portal } from "solid-js/web";

import type { InsertionPickerItem, InsertionPickerRequest } from "./types";

import styles from "../palette.module.css";

interface InsertionPickerProps {
  request: InsertionPickerRequest | null;
  onClose: () => void;
}

const matchesQuery = (item: InsertionPickerItem, query: string): boolean => {
  if (!query) return true;
  const q = query.toLowerCase();
  if (item.label.toLowerCase().includes(q)) return true;
  if (item.description?.toLowerCase().includes(q)) return true;
  if (item.keywords?.some((kw) => kw.toLowerCase().includes(q))) return true;
  return item.value.toLowerCase().includes(q);
};

/**
 * Reusable insertion picker. Rendered once at the app level by the commands
 * provider. The current request (or null) drives open state and content.
 *
 * Search filtering, keyboard navigation, Enter to accept and Esc to cancel
 * are delegated to Ark UI Combobox + Dialog.
 */
const InsertionPicker: Component<InsertionPickerProps> = (props) => {
  const [inputValue, setInputValue] = createSignal("");

  const { collection, filter, set } = useListCollection<InsertionPickerItem>(() => ({
    initialItems: [],
    filter: (_itemText, filterText, item) => matchesQuery(item, filterText),
  }));

  // Sync collection + initial query whenever a new request opens.
  createEffect(() => {
    const req = props.request;
    if (!req) {
      setInputValue("");
      filter("");
      set([]);
      return;
    }
    set(req.items);
    const initial = req.initialQuery ?? "";
    setInputValue(initial);
    filter(initial);
  });

  const handleSelect = (details: { value: string[] }) => {
    const req = props.request;
    if (!req) return;
    const selectedValue = details.value[0];
    if (!selectedValue) return;
    const item = req.items.find((i) => i.value === selectedValue);
    if (!item) return;
    req.onAccept(item, req.replace);
    props.onClose();
  };

  const handleOpenChange = (details: { open: boolean }) => {
    if (!details.open) {
      props.request?.onCancel?.();
      props.onClose();
    }
  };

  return (
    <Dialog.Root onOpenChange={handleOpenChange} open={props.request !== null}>
      <Show when={props.request}>
        {(req) => (
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
                  <div class="border-border-primary flex flex-col gap-1 border-b px-4 pt-4 pb-3.5">
                    <span class="text-text-secondary text-xs leading-4 font-semibold tracking-[0.05em] uppercase select-none">
                      {req().title}
                    </span>
                    <Combobox.Control class="relative flex items-center gap-3">
                      <span
                        aria-hidden
                        class="text-text-secondary i-material-symbols:search size-5 shrink-0"
                      />
                      <Combobox.Input
                        asChild={(inputProps) => (
                          <input
                            {...inputProps()}
                            class="text-text-primary placeholder:text-text-secondary min-w-0 flex-1 border-0 bg-transparent p-0 text-base leading-6 outline-none"
                            placeholder={req().placeholder ?? "Search…"}
                          />
                        )}
                      />
                    </Combobox.Control>
                  </div>

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
                      <For each={collection().items}>
                        {(item) => (
                          <Combobox.Item
                            item={item}
                            class="focus-ring hover:bg-surface-transparent-hover data-[highlighted]:bg-surface-transparent-hover active:bg-surface-transparent-active data-[state=checked]:bg-surface-transparent-active flex cursor-pointer items-start gap-3 rounded-md px-3 py-2.5 transition-colors duration-100 outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
                          >
                            <Show when={item.icon}>
                              <span
                                class={`text-text-secondary mt-0.5 size-[1.125rem] shrink-0 ${item.icon}`}
                              />
                            </Show>
                            <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                              <Combobox.ItemText class="text-text-primary truncate text-sm leading-5 font-medium">
                                {item.label}
                              </Combobox.ItemText>
                              <Show when={item.description}>
                                <span class="text-text-secondary truncate text-xs leading-4">
                                  {item.description}
                                </span>
                              </Show>
                              <Show when={item.preview}>
                                <div class="text-text-secondary mt-1 text-xs leading-4">
                                  {item.preview!()}
                                </div>
                              </Show>
                            </div>
                          </Combobox.Item>
                        )}
                      </For>
                    </Combobox.List>
                  </Combobox.Content>
                </Combobox.Root>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        )}
      </Show>
    </Dialog.Root>
  );
};

export default InsertionPicker;
