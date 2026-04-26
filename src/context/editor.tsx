import type { EditorView } from "@codemirror/view";
import {
  createContext,
  createSignal,
  useContext,
  type Accessor,
  type ParentComponent,
  type Setter,
} from "solid-js";

interface EditorContextValue {
  editorView: Accessor<EditorView | undefined>;
  setEditorView: Setter<EditorView | undefined>;
  previewContainer: Accessor<HTMLElement | undefined>;
  setPreviewContainer: Setter<HTMLElement | undefined>;
}

const EditorContext = createContext<EditorContextValue>();

export const EditorProvider: ParentComponent = (props) => {
  const [editorView, setEditorView] = createSignal<EditorView | undefined>();
  const [previewContainer, setPreviewContainer] = createSignal<HTMLElement | undefined>();

  return (
    <EditorContext.Provider
      value={{ editorView, setEditorView, previewContainer, setPreviewContainer }}
    >
      {props.children}
    </EditorContext.Provider>
  );
};

export const useEditorContext = () => {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error("useEditorContext must be used within EditorProvider");
  }
  return context;
};
