import { type Component, For, type JSX, Show, createMemo, createResource } from "solid-js";

import { queryMemoPathsReferencingMemo } from "../../../db/memoCollection";
import type { MemoWithoutContent } from "../../../types/memo";
import { buildNoteProperties } from "../../../utils/noteProperties";

interface PropertiesTabProps {
  currentPath: string;
  currentContent: string;
  allMemos: MemoWithoutContent[];
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

export const PropertiesTab: Component<PropertiesTabProps> = (props) => {
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

  return (
    <div class="text-text-primary bg-surface-primary h-full overflow-y-auto">
      <div class="border-border-primary border-b px-3 py-2">
        <div class="flex items-center gap-2">
          <span class="i-material-symbols:info-outline-rounded text-text-accent size-4 shrink-0" />
          <h1 class="text-sm font-semibold">Properties</h1>
        </div>
      </div>

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
              <div class="text-text-secondary border-border-primary bg-surface-secondary mb-1 rounded-md border px-2 py-1.5 text-xs leading-4">
                Values in this section are parsed from the current Markdown content, not edited
                independently.
              </div>

              <Show when={info().frontmatter.status === "invalid"}>
                <div class="text-text-danger border-border-primary bg-surface-secondary rounded-md border px-2 py-1.5 text-xs leading-4">
                  Frontmatter issue: {info().frontmatter.message}
                </div>
              </Show>

              <Show when={info().frontmatter.status === "absent"}>
                <div class="text-text-secondary border-border-primary bg-surface-secondary rounded-md border px-2 py-1.5 text-xs leading-4">
                  No frontmatter block found.
                </div>
              </Show>

              <PropertyRow label="Title">
                <Show when={info().frontmatter.title} fallback={<EmptyValue />}>
                  {(title) => <span>{title()}</span>}
                </Show>
              </PropertyRow>
              <PropertyRow label="Tags">
                <Show when={info().frontmatter.tags.length > 0} fallback={<EmptyValue />}>
                  <div class="flex flex-wrap gap-1">
                    <For each={info().frontmatter.tags}>
                      {(tag) => (
                        <span class="bg-surface-secondary text-text-secondary rounded px-1.5 py-0.5 text-xs">
                          {tag}
                        </span>
                      )}
                    </For>
                  </div>
                </Show>
              </PropertyRow>

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
              <PropertyRow label="Count">{info().backlinks.count}</PropertyRow>
              <Show
                when={info().backlinks.paths.length > 0}
                fallback={<div class="text-text-secondary text-sm">No backlinks</div>}
              >
                <div class="flex flex-col gap-1">
                  <For each={info().backlinks.paths}>
                    {(path) => (
                      <div class="text-sm leading-5">
                        <span class="text-text-secondary i-material-symbols:link-rounded mr-1 inline-block size-3.5 align-[-0.125rem]" />
                        <span>{getMemoDisplayName(path, props.allMemos)}</span>
                        <div class="text-text-secondary truncate pl-5 text-xs">{path}</div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </Section>
          </>
        )}
      </Show>
    </div>
  );
};
