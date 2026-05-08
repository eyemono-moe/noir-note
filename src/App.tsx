import type { ParentComponent } from "solid-js";

import CommandPalette from "./commands/palette";
import ToastViewport from "./components/Toast/ToastViewport";
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
            <ToastViewport />
            {props.children}
          </DBProvider>
        </ThemeProvider>
      </CommandsProvider>
    </EditorSplitProvider>
  );
};

export default App;
