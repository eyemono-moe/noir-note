import { useSplitter, type UseSplitterReturn } from "@ark-ui/solid";
import { createContext, useContext, type ParentComponent } from "solid-js";

const EditorSplitContext = createContext<UseSplitterReturn>();

export const EditorSplitProvider: ParentComponent = (props) => {
  const splitter = useSplitter({
    panels: [
      { id: "left", collapsible: true, maxSize: 30, minSize: 10 },
      { id: "center" },
      { id: "right" },
    ],
    defaultSize: [20, 50, 50],
  });

  return (
    <EditorSplitContext.Provider value={splitter}>{props.children}</EditorSplitContext.Provider>
  );
};

export const useEditorSplit = () => {
  const context = useContext(EditorSplitContext);
  if (!context) {
    throw new Error("useEditorSplit must be used within EditorSplitProvider");
  }
  return context;
};
