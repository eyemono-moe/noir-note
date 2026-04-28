import { createContext, useContext, type ParentComponent } from "solid-js";

import { memosCollection } from "../db/memoCollection";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface DBContext {
  memosCollection: typeof memosCollection;
}

const DBContext = createContext<DBContext>();

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Database provider component.
 * The OPFS-backed collection starts syncing as soon as the module loads, so
 * no async initialization is required here — we just make it available via
 * context.
 */
export const DBProvider: ParentComponent = (props) => {
  const value: DBContext = { memosCollection };
  return <DBContext.Provider value={value}>{props.children}</DBContext.Provider>;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook to access the memos TanStack DB collection.
 * The collection may not have finished its initial OPFS enumerate yet;
 * check `useLiveQuery(...).isReady` before rendering note content.
 */
export function useMemosCollection(): typeof memosCollection {
  const context = useContext(DBContext);
  if (!context) {
    throw new Error("useMemosCollection must be used within DBProvider");
  }
  return context.memosCollection;
}
