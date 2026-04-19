import type { ParentComponent } from "solid-js";

import CommandPalette from "./commands/palette";
import { CommandsProvider } from "./context/commands";
import { DBProvider } from "./context/db";
import { EditorSplitProvider } from "./context/editorSplit";
import { ThemeProvider } from "./context/theme";

const App: ParentComponent = (props) => {
  return (
    <EditorSplitProvider>
      <CommandsProvider>
        <ThemeProvider>
          <DBProvider>
            <CommandPalette />
            {props.children}
          </DBProvider>
        </ThemeProvider>
      </CommandsProvider>
    </EditorSplitProvider>
  );
};

export default App;
