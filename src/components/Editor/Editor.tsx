import { createCodeMirror, createEditorControlledValue } from "solid-codemirror";
import { type Component, createEffect } from "solid-js";
import { createEditorExtensions } from "../../editor/extensions";

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

const Editor: Component<EditorProps> = (props) => {
  const { ref, editorView, createExtension } = createCodeMirror({
    onValueChange: props.onChange,
  });

  // Setup extensions
  createExtension(() => createEditorExtensions());

  // Create controlled value - wrap in accessor
  createEffect(() => {
    createEditorControlledValue(editorView, () => props.content);
  });

  return (
    <div class="h-full w-full">
      <div ref={ref} class="h-full" />
    </div>
  );
};

export default Editor;
