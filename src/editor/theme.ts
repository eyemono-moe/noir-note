import { EditorView } from "@codemirror/view";

export const monochromeTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#ffffff",
      color: "#000000",
      height: "100%",
      fontSize: "14px",
      fontFamily: 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace',
    },
    ".cm-content": {
      caretColor: "#000000",
      padding: "16px",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#000000",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "#e0e0e0",
    },
    ".cm-activeLine": {
      backgroundColor: "#f5f5f5",
    },
    ".cm-gutters": {
      backgroundColor: "#ffffff",
      color: "#666666",
      border: "none",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "#f5f5f5",
    },
    ".cm-scroller": {
      fontFamily: 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace',
    },
  },
  { dark: false },
);
