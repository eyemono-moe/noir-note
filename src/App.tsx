import type { ParentComponent } from "solid-js";

import { DBProvider } from "./context/db";

const App: ParentComponent = (props) => {
  return <DBProvider>{props.children}</DBProvider>;
};

export default App;
