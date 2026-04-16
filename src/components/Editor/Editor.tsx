import { createCodeMirror, createEditorControlledValue } from "solid-codemirror";
import { type Component } from "solid-js";

import { createEditorExtensions } from "../../editor/extensions";

import "../../styles/editor.css";

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

const Editor: Component<EditorProps> = (props) => {
  const { ref, editorView, createExtension } = createCodeMirror({
    onValueChange: (value) => props.onChange(value),
  });

  // Setup extensions (pass the array directly)
  createExtension(createEditorExtensions);

  // Create controlled value
  createEditorControlledValue(editorView, () => props.content);

  return (
    <div class="h-full w-full">
      <div ref={ref} class="h-full" />
    </div>
  );
};

export default Editor;
