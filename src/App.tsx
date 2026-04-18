import type { ParentComponent } from "solid-js";

import { DBProvider } from "./context/db";
import { ThemeProvider } from "./context/theme";

const App: ParentComponent = (props) => {
  return (
    <ThemeProvider>
      <DBProvider>{props.children}</DBProvider>
    </ThemeProvider>
  );
};

export default App;
