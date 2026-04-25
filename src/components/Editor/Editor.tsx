import type { EditorView } from "@codemirror/view";
import { createCodeMirror, createEditorControlledValue } from "solid-codemirror";
import { createEffect, type Component } from "solid-js";

import { useTheme } from "../../context/theme";
import { createEditorExtensions } from "../../editor/extensions";

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  /** Called whenever the EditorView instance becomes available (or changes).
   *  Receives the view instance directly so it can be stored in a plain signal. */
  onEditorView?: (view: EditorView | undefined) => void;
}

const Editor: Component<EditorProps> = (props) => {
  const isDark = useTheme();

  const { ref, editorView, createExtension } = createCodeMirror({
    onValueChange: (value) => props.onChange(value),
  });

  // Setup extensions with theme
  createExtension(() => createEditorExtensions(isDark()));

  // Create controlled value
  createEditorControlledValue(editorView, () => props.content);

  // Notify parent whenever the EditorView instance changes (undefined → view on mount,
  // view → undefined on unmount).  We call editorView() inside createEffect so
  // reactivity is tracked correctly.
  createEffect(() => {
    props.onEditorView?.(editorView());
  });

  return (
    <div class="h-full w-full">
      <div ref={ref} class="h-full" />
    </div>
  );
};

export default Editor;
