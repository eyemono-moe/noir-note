import type { ParentComponent } from "solid-js";
import { StorageProvider } from "./context/storage";

const App: ParentComponent = (props) => {
  return <StorageProvider>{props.children}</StorageProvider>;
};

export default App;
