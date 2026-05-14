import type { ParentComponent } from "solid-js";

import CommandPalette from "./commands/palette";
import ToastViewport from "./components/Toast/ToastViewport";
import { CommandsProvider } from "./context/commands";
import { DBProvider } from "./context/db";
import { EditorProvider } from "./context/editor";
import { EditorSplitProvider } from "./context/editorSplit";
import { ThemeProvider } from "./context/theme";
import { SearchProvider } from "./search/SearchProvider";

const App: ParentComponent = (props) => {
  return (
    <EditorSplitProvider>
      <EditorProvider>
        <CommandsProvider>
          <ThemeProvider>
            <DBProvider>
              <SearchProvider>
                <CommandPalette />
                <ToastViewport />
                {props.children}
              </SearchProvider>
            </DBProvider>
          </ThemeProvider>
        </CommandsProvider>
      </EditorProvider>
    </EditorSplitProvider>
  );
};

export default App;
