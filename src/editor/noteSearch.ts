import { openSearchPanel, SearchQuery, setSearchQuery } from "@codemirror/search";
import type { StateEffect } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

type OpenPanel = (view: EditorView) => void;
type FocusPanelInput = (view: EditorView) => void;
type EnqueueFocus = (callback: () => void) => void;
type MakeSearchQueryEffect = (query: string) => StateEffect<SearchQuery>;

interface OpenNoteSearchPanelOptions {
  query?: string;
  openPanel?: OpenPanel;
  focusPanelInput?: FocusPanelInput;
  enqueue?: EnqueueFocus;
  makeSearchQueryEffect?: MakeSearchQueryEffect;
}

function focusSearchPanelInput(view: EditorView): void {
  const input = view.dom.querySelector<HTMLInputElement>(
    ".cm-search input[name='search'], .cm-search input[type='text'], .cm-search input",
  );
  input?.focus();
  input?.select();
}

export function openNoteSearchPanel(
  view: EditorView | undefined,
  options: OpenNoteSearchPanelOptions = {},
): boolean {
  if (!view) return false;

  const openPanel = options.openPanel ?? openSearchPanel;
  const focusPanelInput = options.focusPanelInput ?? focusSearchPanelInput;
  const enqueue = options.enqueue ?? ((callback) => requestAnimationFrame(callback));
  const makeSearchQueryEffect =
    options.makeSearchQueryEffect ??
    ((query: string) => setSearchQuery.of(new SearchQuery({ search: query })));

  view.focus();
  if (options.query) {
    view.dispatch({ effects: makeSearchQueryEffect(options.query) });
  }
  openPanel(view);
  enqueue(() => focusPanelInput(view));

  return true;
}
