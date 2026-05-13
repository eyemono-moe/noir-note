import { Combobox, useListCollection } from "@ark-ui/solid/combobox";
import { HoverCard } from "@ark-ui/solid/hover-card";
import { useFilter } from "@ark-ui/solid/locale";
import {
  type Component,
  For,
  type JSX,
  Show,
  Suspense,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  lazy,
} from "solid-js";
import { Portal } from "solid-js/web";

import { queryMemoPathsReferencingMemo } from "../../../db/memoCollection";
import type { MemoWithoutContent } from "../../../types/memo";
import { collectFrontmatterTags, updateEditableFrontmatter } from "../../../utils/frontmatterEdit";
import { buildNoteProperties } from "../../../utils/noteProperties";

import treeStyles from "../tree.module.css";

const MemoPreview = lazy(() => import("../MemoPreview"));

interface PropertiesTabProps {
  currentPath: string;
  currentContent: string;
  onCurrentContentChange: (content: string) => void;
  allMemos: MemoWithoutContent[];
  onNavigate: (path: string) => void;
}

const formatAbsoluteDateTime = (iso: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));

const getMemoDisplayName = (path: string, allMemos: MemoWithoutContent[]): string => {
  const memo = allMemos.find((m) => m.path === path);
  if (memo?.metadata?.title) return memo.metadata.title;
  const segments = path.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? path;
};

const Section: Component<{ title: string; children: JSX.Element }> = (props) => (
  <section class="border-border-primary border-b px-3 py-3 last:border-b-0">
    <h2 class="text-text-secondary mb-2 text-[0.6875rem] font-bold tracking-[0.06em] uppercase">
      {props.title}
    </h2>
    <div class="flex flex-col gap-2">{props.children}</div>
  </section>
);

const PropertyRow: Component<{ label: string; children: JSX.Element }> = (props) => (
  <div class="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 text-sm leading-5">
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

  createEffect(() => {
    set(collectFrontmatterTags(props.allMemos).map((tag) => ({ label: tag, value: tag })));
  });

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
      <PropertyRow label="Title">
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
      <PropertyRow label="Tags">
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
  const [activePath, setActivePath] = createSignal<string | null>(null);
  const currentMemo = createMemo(() =>
    props.allMemos.find((memo) => memo.path === props.currentPath),
  );

  const backlinkSource = () => {
    const memos = props.allMemos;
    let maxUpdated = 0;
    for (const memo of memos) {
      if (memo.updatedAt > maxUpdated) maxUpdated = memo.updatedAt;
    }
    return { path: props.currentPath, key: `${memos.length}:${maxUpdated}` };
  };

  const [backlinks] = createResource<string[], { path: string; key: string }>(
    backlinkSource,
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
    <HoverCard.Root
      lazyMount
      unmountOnExit
      openDelay={600}
      closeDelay={200}
      positioning={{ placement: "right-start", offset: { mainAxis: 8, crossAxis: 0 } }}
      onTriggerValueChange={(event) => setActivePath(event.value)}
    >
      <div class="text-text-primary bg-surface-primary h-full overflow-y-auto">
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
              <Section title="System">
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

              <Section title="Frontmatter">
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
                          <PropertyRow label={field.key}>
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

              <Section title="Backlinks">
                <div class="text-text-secondary text-xs leading-4">
                  Same backlink list as Explorer. Hover a note to preview it.
                </div>
                <PropertyRow label="Count">{info().backlinks.count}</PropertyRow>
                <Show
                  when={info().backlinks.paths.length > 0}
                  fallback={<div class="text-text-secondary text-sm">No backlinks</div>}
                >
                  <div class="flex flex-col gap-0.5">
                    <For each={info().backlinks.paths}>
                      {(path) => (
                        <HoverCard.Trigger
                          value={path}
                          asChild={(hoverProps) => (
                            <button
                              {...hoverProps()}
                              type="button"
                              class="focus-ring text-text-primary hover:bg-surface-transparent-hover w-full cursor-pointer rounded-md bg-transparent px-2 py-1 text-start text-sm leading-5 select-none"
                              onClick={() => props.onNavigate(path)}
                            >
                              <span class="text-text-secondary i-material-symbols:link-rounded mr-1 inline-block size-3.5 align-[-0.125rem]" />
                              <span>{getMemoDisplayName(path, props.allMemos)}</span>
                              <div class="text-text-secondary truncate pl-5 text-xs">{path}</div>
                            </button>
                          )}
                        />
                      )}
                    </For>
                  </div>
                </Show>
              </Section>
            </>
          )}
        </Show>
      </div>
      <Portal>
        <HoverCard.Positioner>
          <HoverCard.Content class={treeStyles.HoverCardContent}>
            <Suspense>
              <Show when={activePath()}>{(path) => <MemoPreview path={path()} />}</Show>
            </Suspense>
          </HoverCard.Content>
        </HoverCard.Positioner>
      </Portal>
    </HoverCard.Root>
  );
};
