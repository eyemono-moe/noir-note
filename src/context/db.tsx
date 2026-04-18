import { createContext, useContext, type ParentComponent } from "solid-js";
import { createResource, type Resource } from "solid-js";

import { createNoirNotesDB, type NoirNotesDatabase } from "../db/rxdb";
import { createMemosCollection, type MemosCollection } from "../db/tanstack";

/**
 * Database context value
 */
interface DBContext {
  memosCollection: Resource<MemosCollection | undefined>;
}

const DBContext = createContext<DBContext>();

/**
 * Initialize databases
 */
async function initializeDatabases(): Promise<{
  rxdb: NoirNotesDatabase;
  memosCollection: MemosCollection;
}> {
  // Create RxDB
  const rxdb = await createNoirNotesDB();

  // Create TanStack DB collection
  const memosCollection = createMemosCollection(rxdb);

  return { rxdb, memosCollection };
}

/**
 * Database provider component
 */
export const DBProvider: ParentComponent = (props) => {
  const [dbResource] = createResource(initializeDatabases);

  // Create a derived resource for memosCollection
  const [memosCollectionResource] = createResource(
    () => dbResource(),
    (db) => db.memosCollection,
  );

  const value: DBContext = {
    memosCollection: memosCollectionResource,
  };

  return <DBContext.Provider value={value}>{props.children}</DBContext.Provider>;
};

/**
 * Hook to access Memos Collection
 */
export function useMemosCollection(): Resource<MemosCollection | undefined> {
  const context = useContext(DBContext);
  if (!context) {
    throw new Error("useMemosCollection must be used within DBProvider");
  }
  return context.memosCollection;
}
