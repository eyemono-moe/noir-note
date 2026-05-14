import { Accordion } from "@ark-ui/solid/accordion";
import { Combobox, useListCollection } from "@ark-ui/solid/combobox";
import { useFilter } from "@ark-ui/solid/locale";
import {
  type Component,
  For,
  type JSX,
  Show,
  createEffect,
  createMemo,
  createResource,
  createSignal,
} from "solid-js";
import { Portal } from "solid-js/web";

import { queryMemoPathsReferencingMemo } from "../../../db/memoCollection";
import {
  updatePropertiesAccordionState,
  usePropertiesAccordionState,
} from "../../../store/configStore";
import type { MemoWithoutContent } from "../../../types/memo";
import { collectFrontmatterTags, updateEditableFrontmatter } from "../../../utils/frontmatterEdit";
import { buildNoteProperties } from "../../../utils/noteProperties";
import { BacklinkList } from "../Backlinks";
import { Outline } from "../Outline";

import styles from "../sidebar.module.css";

interface PropertiesTabProps {
  currentPath: string;
  currentContent: string;
  onCurrentContentChange: (content: string) => void;
  allMemos: MemoWithoutContent[];
  onNavigate: (path: string) => void;
}

const createBacklinkSource =
  (currentPath: () => string, allMemos: () => MemoWithoutContent[]) => () => {
    const memos = allMemos();
    let maxUpdated = 0;
    for (const memo of memos) {
      if (memo.updatedAt > maxUpdated) maxUpdated = memo.updatedAt;
    }
    return { path: currentPath(), key: `${memos.length}:${maxUpdated}` };
  };

const formatAbsoluteDateTime = (iso: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));

const Section: Component<{
  title: string;
  value: string;
  fill?: boolean;
  children: JSX.Element;
}> = (props) => (
  <Accordion.Item
    class={`flex shrink-0 flex-col overflow-hidden ${
      props.fill ? "data-[state=open]:min-h-0 data-[state=open]:flex-1" : ""
    }`}
    value={props.value}
  >
    <Accordion.ItemTrigger class="focus-ring text-text-secondary hover:bg-surface-transparent-hover hover:text-text-primary flex w-full shrink-0 cursor-pointer items-center justify-between bg-transparent px-3 py-1.5 text-[0.6875rem] font-bold tracking-[0.06em] uppercase select-none">
      <span>{props.title}</span>
      <Accordion.ItemIndicator class="inline-flex items-center justify-center [transition:rotate_150ms_ease] data-[state=open]:[rotate:90deg]">
        <span class="i-material-symbols:chevron-right-rounded size-3.5 shrink-0" />
      </Accordion.ItemIndicator>
    </Accordion.ItemTrigger>
    <Accordion.ItemContent class={styles.ItemContent}>
      <div class="flex min-h-0 flex-1 flex-col gap-2 px-3 py-3">{props.children}</div>
    </Accordion.ItemContent>
  </Accordion.Item>
);

const PropertyRow: Component<{
  label: string;
  orientation?: "horizontal" | "vertical";
  children: JSX.Element;
}> = (props) => (
  <div
    class={
      props.orientation === "vertical"
        ? "flex flex-col gap-1 text-sm"
        : "grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 text-sm"
    }
  >
    <div class="text-text-secondary truncate">{props.label}</div>
    <div class="text-text-primary min-w-0 break-words">{props.children}</div>
  </div>
);

const EmptyValue: Component = () => <span class="text-text-secondary italic">Not set</span>;

interface TagOption {
  label: string;
  value: string;
}

const normalizeTags = (tags: string[]) =>
  Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );

const EditableFrontmatterFields: Component<{
  title: string | undefined;
  tags: string[];
  allMemos: MemoWithoutContent[];
  onChange: (next: { title: string; tags: string[] }) => void;
}> = (props) => {
  const [title, setTitle] = createSignal("");
  const [tags, setTags] = createSignal<string[]>([]);
  const [tagInput, setTagInput] = createSignal("");
  const filterFn = useFilter({ sensitivity: "base" });

  const { collection, filter, set } = useListCollection<TagOption>({
    initialItems: [],
    filter: (item, input) => filterFn().contains(item, input),
  });

  // Keep the tag suggestion collection in sync with memo metadata so users can
  // select tags that already exist in other notes. This currently scans the
  // sidebar memo list; if this becomes hot with large vaults, move the distinct
  // tag aggregation into TanStack DB or another indexed derived query.
  createEffect(() => {
    set(collectFrontmatterTags(props.allMemos).map((tag) => ({ label: tag, value: tag })));
  });

  // Reset local edit controls when the selected note/frontmatter changes. The
  // inputs keep local state while focused, but must reflect navigation and
  // external content updates instead of leaking values across notes.
  createEffect(() => {
    setTitle(props.title ?? "");
    setTags(normalizeTags(props.tags));
  });

  const commit = (nextTitle = title(), nextTags = tags()) => {
    props.onChange({ title: nextTitle, tags: normalizeTags(nextTags) });
  };

  const addTypedTag = () => {
    const nextTag = tagInput().trim();
    if (!nextTag) return;
    const nextTags = normalizeTags([...tags(), nextTag]);
    setTags(nextTags);
    setTagInput("");
    filter("");
    commit(title(), nextTags);
  };

  const removeTag = (tag: string) => {
    const nextTags = tags().filter((value) => value !== tag);
    setTags(nextTags);
    commit(title(), nextTags);
  };

  return (
    <>
      <PropertyRow label="Title" orientation="vertical">
        <input
          class="focus-ring border-border-primary bg-surface-secondary text-text-primary placeholder:text-text-secondary w-full rounded border px-2 py-1 text-sm"
          value={title()}
          placeholder="Untitled"
          onInput={(event) => setTitle(event.currentTarget.value)}
          onBlur={() => commit()}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      </PropertyRow>
      <PropertyRow label="Tags" orientation="vertical">
        <Combobox.Root<TagOption>
          collection={collection()}
          value={tags()}
          inputValue={tagInput()}
          onInputValueChange={(details) => {
            setTagInput(details.inputValue);
            filter(details.inputValue);
          }}
          onValueChange={(details) => {
            const nextTags = normalizeTags(details.value);
            setTags(nextTags);
            commit(title(), nextTags);
          }}
          onOpenChange={(details) => {
            if (details.reason === "trigger-click") filter("");
          }}
          multiple
          allowCustomValue
          closeOnSelect={false}
          openOnClick
          positioning={{ placement: "bottom-start", offset: { mainAxis: 4, crossAxis: 0 } }}
        >
          <div class="flex flex-col gap-1.5">
            <div class="flex flex-wrap gap-1">
              <Show when={tags().length > 0} fallback={<EmptyValue />}>
                <For each={tags()}>
                  {(tag) => (
                    <span class="bg-surface-secondary text-text-secondary inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs">
                      {tag}
                      <button
                        type="button"
                        class="focus-ring hover:text-text-primary inline-flex size-3.5 items-center justify-center rounded bg-transparent"
                        aria-label={`Remove ${tag}`}
                        onClick={() => removeTag(tag)}
                      >
                        <span class="i-material-symbols:close-rounded size-3" />
                      </button>
                    </span>
                  )}
                </For>
              </Show>
            </div>
            <Combobox.Control class="relative">
              <Combobox.Input
                class="focus-ring border-border-primary bg-surface-secondary text-text-primary placeholder:text-text-secondary w-full rounded border px-2 py-1 pr-8 text-sm"
                placeholder="Add tag"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && tagInput().trim()) {
                    event.preventDefault();
                    addTypedTag();
                  }
                }}
                onBlur={addTypedTag}
              />
              <Combobox.Trigger class="text-text-secondary hover:text-text-primary absolute top-1/2 right-1 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded bg-transparent">
                <span class="i-material-symbols:expand-more-rounded size-4" />
              </Combobox.Trigger>
            </Combobox.Control>
          </div>
          <Portal>
            <Combobox.Positioner>
              <Combobox.Content class="border-border-primary bg-surface-primary z-50 flex max-h-60 min-w-[var(--reference-width)] flex-col gap-0.5 overflow-y-auto rounded-md border p-1 shadow-lg outline-none">
                <Combobox.Empty class="text-text-secondary px-2 py-1.5 text-sm">
                  Type a tag and press Enter to create it
                </Combobox.Empty>
                <For each={collection().items}>
                  {(item) => (
                    <Combobox.Item
                      item={item}
                      class="data-[highlighted]:bg-surface-transparent-hover data-[state=checked]:text-text-accent flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-sm outline-none select-none"
                    >
                      <Combobox.ItemText class="min-w-0 flex-1 truncate">
                        {item.label}
                      </Combobox.ItemText>
                      <Combobox.ItemIndicator class="inline-flex items-center justify-center">
                        <span class="i-material-symbols:check-rounded size-4" />
                      </Combobox.ItemIndicator>
                    </Combobox.Item>
                  )}
                </For>
              </Combobox.Content>
            </Combobox.Positioner>
          </Portal>
        </Combobox.Root>
      </PropertyRow>
    </>
  );
};

export const PropertiesTab: Component<PropertiesTabProps> = (props) => {
  const accordionState = usePropertiesAccordionState();

  const currentMemo = createMemo(() =>
    props.allMemos.find((memo) => memo.path === props.currentPath),
  );

  const [backlinks] = createResource<string[], { path: string; key: string }>(
    createBacklinkSource(
      () => props.currentPath,
      () => props.allMemos,
    ),
    (source) => queryMemoPathsReferencingMemo(source.path),
    { initialValue: [] },
  );

  const properties = createMemo(() => {
    const memo = currentMemo();
    if (!memo) return undefined;
    return buildNoteProperties({
      memo,
      content: props.currentContent,
      backlinks: backlinks.latest ?? [],
    });
  });

  const updateFrontmatter = (next: { title: string; tags: string[] }) => {
    props.onCurrentContentChange(updateEditableFrontmatter(props.currentContent, next));
  };

  return (
    <Accordion.Root
      class="text-text-primary bg-surface-primary divide-border-primary flex h-full w-full flex-col divide-y overflow-hidden"
      multiple
      collapsible
      lazyMount
      value={accordionState()}
      onValueChange={(details) => updatePropertiesAccordionState(details.value)}
    >
      <Show
        when={properties()}
        fallback={
          <div class="text-text-secondary px-4 py-8 text-center text-sm">
            No current note metadata
          </div>
        }
      >
        {(info) => (
          <>
            <Section title="System" value="system">
              <PropertyRow label="Path">
                <code class="bg-surface-secondary rounded px-1.5 py-0.5 text-xs">
                  {info().system.path}
                </code>
              </PropertyRow>
              <PropertyRow label="Created">
                <time dateTime={info().system.createdAtIso} title={info().system.createdAtIso}>
                  {formatAbsoluteDateTime(info().system.createdAtIso)}
                </time>
              </PropertyRow>
              <PropertyRow label="Updated">
                <time dateTime={info().system.updatedAtIso} title={info().system.updatedAtIso}>
                  {formatAbsoluteDateTime(info().system.updatedAtIso)}
                </time>
              </PropertyRow>
            </Section>

            <Section title="Frontmatter" value="frontmatter">
              <Show when={info().frontmatter.status === "invalid"}>
                <div class="text-text-danger border-border-primary bg-surface-secondary rounded-md border px-2 py-1.5 text-xs leading-4">
                  Frontmatter issue: {info().frontmatter.message}
                </div>
              </Show>

              <Show when={info().frontmatter.status === "absent"}>
                <div class="text-text-secondary border-border-primary bg-surface-secondary rounded-md border px-2 py-1.5 text-xs leading-4">
                  No frontmatter block found. Editing title or tags will create one.
                </div>
              </Show>

              <EditableFrontmatterFields
                title={info().frontmatter.title}
                tags={info().frontmatter.tags}
                allMemos={props.allMemos}
                onChange={updateFrontmatter}
              />

              <Show when={info().frontmatter.extraFields.length > 0}>
                <div class="border-border-primary mt-1 border-t pt-2">
                  <div class="text-text-secondary mb-1 text-xs font-medium">Extra keys</div>
                  <div class="flex flex-col gap-1.5">
                    <For each={info().frontmatter.extraFields}>
                      {(field) => (
                        <PropertyRow label={field.key} orientation="horizontal">
                          <code class="bg-surface-secondary rounded px-1.5 py-0.5 text-xs">
                            {field.value}
                          </code>
                        </PropertyRow>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </Section>

            <Section title="Outline" value="outline" fill>
              <Outline />
            </Section>

            <Section title="Backlinks" value="backlinks" fill>
              <BacklinkList
                paths={info().backlinks.paths}
                allMemos={props.allMemos}
                onNavigate={props.onNavigate}
              />
            </Section>
          </>
        )}
      </Show>
    </Accordion.Root>
  );
};
