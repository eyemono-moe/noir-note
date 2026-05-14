import { Compartment, StateEffect } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

const extensionCompartments = new WeakMap<EditorView, Compartment>();

/**
 * Ensure the editor view's current state contains the dynamic extension
 * compartment used for app-level CodeMirror features.
 *
 * `solid-codemirror` appends compartment extensions to the initial state, but
 * `EditorView.setState()` replaces that state wholesale. Path transitions that
 * restore a cached state or create a fresh one therefore have to reinstall the
 * compartment on the new state; otherwise visible features such as line numbers,
 * markdown highlighting, and autocomplete silently disappear.
 */
export function ensureEditorExtensions(view: EditorView, extensions: Extension[]): void {
  const compartment = extensionCompartments.get(view) ?? new Compartment();
  extensionCompartments.set(view, compartment);

  const effect = compartment.get(view.state)
    ? compartment.reconfigure(extensions)
    : StateEffect.appendConfig.of(compartment.of(extensions));

  view.dispatch({ effects: effect });
}
