import { createContext, createMemo, useContext } from "solid-js";
import type { ParentComponent } from "solid-js";

import { EditorStateLRUCache } from "./editorStateCache";

const EditorCacheContext = createContext<(() => EditorStateLRUCache) | null>(null);

export const EditorCacheProvider: ParentComponent<{
  cache?: EditorStateLRUCache;
  maxSize?: number;
}> = (props) => {
  const cache = createMemo(
    () => props.cache ?? new EditorStateLRUCache({ maxSize: props.maxSize }),
  );
  return <EditorCacheContext.Provider value={cache}>{props.children}</EditorCacheContext.Provider>;
};

export const useEditorStateCache = (): EditorStateLRUCache => {
  const ctx = useContext(EditorCacheContext);
  if (!ctx) {
    const defaultCache = new EditorStateLRUCache();
    return defaultCache;
  }
  return ctx();
};
