import type { EditorView } from "@codemirror/view";
import {
  createContext,
  createSignal,
  useContext,
  type Accessor,
  type ParentComponent,
  type Setter,
} from "solid-js";

import type { PreviewScrollAdapter } from "../types/scrollSync";

interface EditorContextValue {
  editorView: Accessor<EditorView | undefined>;
  setEditorView: Setter<EditorView | undefined>;
  previewAdapter: Accessor<PreviewScrollAdapter | undefined>;
  setPreviewAdapter: Setter<PreviewScrollAdapter | undefined>;
}

const EditorContext = createContext<EditorContextValue>();

export const EditorProvider: ParentComponent = (props) => {
  const [editorView, setEditorView] = createSignal<EditorView | undefined>();
  const [previewAdapter, setPreviewAdapter] = createSignal<PreviewScrollAdapter | undefined>();

  return (
    <EditorContext.Provider
      value={{ editorView, setEditorView, previewAdapter, setPreviewAdapter }}
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
