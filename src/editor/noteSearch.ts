import { openSearchPanel } from "@codemirror/search";
import type { EditorView } from "@codemirror/view";

type OpenPanel = (view: EditorView) => void;
type FocusPanelInput = (view: EditorView) => void;
type EnqueueFocus = (callback: () => void) => void;

interface OpenNoteSearchPanelOptions {
  openPanel?: OpenPanel;
  focusPanelInput?: FocusPanelInput;
  enqueue?: EnqueueFocus;
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

  view.focus();
  openPanel(view);
  enqueue(() => focusPanelInput(view));

  return true;
}
