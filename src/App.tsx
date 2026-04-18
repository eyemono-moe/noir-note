import type { ParentComponent } from "solid-js";

import { DBProvider } from "./context/db";
import { EditorSplitProvider } from "./context/editorSplit";
import { ThemeProvider } from "./context/theme";

const App: ParentComponent = (props) => {
  return (
    <EditorSplitProvider>
      <ThemeProvider>
        <DBProvider>{props.children}</DBProvider>
      </ThemeProvider>
    </EditorSplitProvider>
  );
};

export default App;
