import { createEffect, createSignal, For, Show, type Component } from "solid-js";

import type { PageSearchResult } from "../../../commands/types";
import { useSearch } from "../../../search/SearchProvider";
import { buildSidebarSearchGroups } from "../searchPanel";

const SEARCH_RESULT_LIMIT = 100;

interface SearchTabProps {
  onNavigateToResult: (path: string, query: string) => void;
}

export const SearchTab: Component<SearchTabProps> = (props) => {
  const [query, setQuery] = createSignal("");
  const [isSearching, setSearching] = createSignal(false);
  const [error, setError] = createSignal<string | undefined>();
  const [results, setResults] = createSignal<PageSearchResult[]>([]);
  const search = useSearch();

  // Perform search when query changes
  createEffect(() => {
    const nextQuery = query();
    if (!nextQuery.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }

    const indexError = search.error();
    const isIndexReady = search.isReady();
    if (indexError) {
      setResults([]);
      setSearching(false);
      setError("Search index failed to update.");
      return;
    }

    if (!isIndexReady) {
      setResults([]);
      setSearching(true);
      setError(undefined);
      return;
    }

    let cancelled = false;
    setSearching(true);
    setError(undefined);
    void search
      .search(nextQuery, { limit: SEARCH_RESULT_LIMIT })
      .then((nextResults) => {
        if (!cancelled) setResults(nextResults);
      })
      .catch((caught: unknown) => {
        console.error("[SidebarSearch] Search query failed:", caught);
        if (!cancelled) {
          setError("Search failed.");
          setResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });

    return () => {
      cancelled = true;
    };
  });

  const groups = () => buildSidebarSearchGroups(results(), query());

  return (
    <section class="text-text-primary flex h-full min-h-0 flex-col overflow-hidden">
      <header class="border-border-primary shrink-0 border-b px-3 py-2">
        <div class="text-text-secondary mb-2 text-[0.6875rem] font-bold tracking-[0.06em] uppercase">
          Search
        </div>
        <label
          aria-label="Search notes"
          class="focus-within:focus-ring border-border-primary bg-surface-secondary flex items-center gap-2 rounded-md border px-2 py-1.5"
        >
          <span class="i-material-symbols:search text-text-secondary size-4 shrink-0" />
          <input
            value={query()}
            onInput={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search notes or tag:work"
            class="text-text-primary placeholder:text-text-secondary min-w-0 flex-1 border-0 bg-transparent p-0 text-sm leading-5 outline-none"
            type="search"
            spellcheck={false}
          />
        </label>
      </header>

      <div class="min-h-0 flex-1 overflow-auto p-2">
        <Show when={error()}>
          {(message) => <p class="text-text-danger px-2 py-3 text-sm">{message()}</p>}
        </Show>

        <Show when={!query().trim()}>
          <div class="text-text-secondary flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm">
            <span class="i-material-symbols:manage-search size-8 opacity-50" />
            <p class="m-0">Search across note titles, paths, content, and tags.</p>
          </div>
        </Show>

        <Show when={query().trim() && isSearching()}>
          <p class="text-text-secondary px-2 py-3 text-sm">Searching…</p>
        </Show>

        <Show when={query().trim() && !isSearching() && groups().length === 0 && !error()}>
          <div class="text-text-secondary flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm">
            <span class="i-material-symbols:search-off size-8 opacity-50" />
            <p class="m-0">No results found</p>
          </div>
        </Show>

        <div class="flex flex-col gap-2">
          <For each={groups()}>
            {(group) => (
              <article class="rounded-md">
                <button
                  type="button"
                  class="focus-ring hover:bg-surface-transparent-hover flex w-full min-w-0 items-center gap-2 rounded-md bg-transparent px-2 py-1.5 text-left"
                  onClick={() => props.onNavigateToResult(group.path, query())}
                >
                  <span class="i-material-symbols:description-outline-rounded text-text-secondary size-4 shrink-0" />
                  <span class="min-w-0 flex-1 truncate text-sm font-medium">{group.title}</span>
                </button>
                <div class="ml-6 flex flex-col gap-0.5">
                  <For each={group.matches}>
                    {(match) => (
                      <button
                        type="button"
                        class="focus-ring hover:bg-surface-transparent-hover text-text-secondary w-full rounded bg-transparent px-2 py-1 text-left text-xs leading-5"
                        onClick={() => props.onNavigateToResult(group.path, query())}
                      >
                        <For each={match.preview}>
                          {(part) => (
                            <span
                              class={
                                part.matched
                                  ? "bg-surface-transparent-accent text-text-primary rounded px-0.5"
                                  : undefined
                              }
                            >
                              {part.text}
                            </span>
                          )}
                        </For>
                      </button>
                    )}
                  </For>
                </div>
              </article>
            )}
          </For>
        </div>
      </div>
    </section>
  );
};
