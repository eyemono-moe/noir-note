import { createCodeMirror, createEditorControlledValue } from "solid-codemirror";
import { type Component } from "solid-js";

import { useTheme } from "../../context/theme";
import { createEditorExtensions } from "../../editor/extensions";

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
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

  return (
    <div class="h-full w-full">
      <div ref={ref} class="h-full" />
    </div>
  );
};

export default Editor;
