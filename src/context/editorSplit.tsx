import { useSplitter, type UseSplitterReturn } from "@ark-ui/solid";
import { createContext, useContext, type ParentComponent } from "solid-js";

import { updateSplitterSizes, useConfig } from "../store/configStore";

const EditorSplitContext = createContext<UseSplitterReturn>();

const DEFAULT_SPLITTER_SIZES = [20, 50, 50];

export const EditorSplitProvider: ParentComponent = (props) => {
  const [config] = useConfig();
  const splitter = useSplitter({
    panels: [
      { id: "left", collapsible: true, maxSize: 30, minSize: 10 },
      { id: "center" },
      { id: "right" },
    ],
    defaultSize: config.splitterSizes ?? DEFAULT_SPLITTER_SIZES,
    onResizeEnd: (details) => {
      updateSplitterSizes(details.size);
    },
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
