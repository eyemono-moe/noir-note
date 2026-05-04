import { useLocation } from "@solidjs/router";
import {
  createContext,
  createMemo,
  useContext,
  type Accessor,
  type ParentComponent,
} from "solid-js";

import { useMemoContent } from "../hooks/useMemoOperations";
import { normalizePath } from "../utils/path";

interface CurrentMemoContextValue {
  path: Accessor<string>;
  content: Accessor<string>;
  setContent: (content: string) => void;
  isReady: Accessor<boolean>;
}

const CurrentMemoContext = createContext<CurrentMemoContextValue>();

export const CurrentMemoProvider: ParentComponent = (props) => {
  const location = useLocation();
  const currentPath = createMemo(() => normalizePath(location.pathname));

  // oxlint-disable-next-line solid/reactivity
  const { content, setContent, isReady } = useMemoContent(currentPath);

  return (
    <CurrentMemoContext.Provider value={{ path: currentPath, content, setContent, isReady }}>
      {props.children}
    </CurrentMemoContext.Provider>
  );
};

export const useCurrentMemo = () => {
  const context = useContext(CurrentMemoContext);
  if (!context) {
    throw new Error("useCurrentMemo must be used within CurrentMemoProvider");
  }
  return context;
};
