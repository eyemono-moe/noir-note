import type { EditorView } from "@codemirror/view";
import { createCodeMirror, createEditorControlledValue } from "solid-codemirror";
import { type Accessor, createEffect, type Component } from "solid-js";

import { useTheme } from "../../context/theme";
import { createEditorExtensions } from "../../editor/extensions";

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  /** Called whenever the EditorView instance changes (or becomes ready).
   *  Pass a signal setter to obtain a reactive reference to the view. */
  onEditorView?: (view: Accessor<EditorView | undefined>) => void;
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

  // Expose the editorView accessor to the parent once (on first call)
  createEffect(() => {
    props.onEditorView?.(editorView);
  });

  return (
    <div class="h-full w-full">
      <div ref={ref} class="h-full" />
    </div>
  );
};

export default Editor;
