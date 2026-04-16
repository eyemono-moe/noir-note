import { createContext, useContext, type ParentComponent } from "solid-js";
import { createResource, type Resource } from "solid-js";

import { migrateFromOldIndexedDB } from "../db/migration";
import { createNoirNotesDB, type NoirNotesDatabase } from "../db/rxdb";
import { createMemosCollection, type MemosCollection } from "../db/tanstack";

/**
 * Database context value
 */
interface DBContext {
  rxdb: Resource<NoirNotesDatabase | undefined>;
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
  console.log("[DB Context] Initializing databases...");

  // Create RxDB
  const rxdb = await createNoirNotesDB();

  // Migrate from old IndexedDB (only runs once, safe to call multiple times)
  await migrateFromOldIndexedDB(rxdb);

  // Create TanStack DB collection
  const memosCollection = createMemosCollection(rxdb);

  console.log("[DB Context] Databases initialized successfully");

  return { rxdb, memosCollection };
}

/**
 * Database provider component
 */
export const DBProvider: ParentComponent = (props) => {
  const [dbResource] = createResource(initializeDatabases);

  // Create a derived resource for rxdb
  const [rxdbResource] = createResource(
    () => dbResource(),
    (db) => db.rxdb,
  );

  // Create a derived resource for memosCollection
  const [memosCollectionResource] = createResource(
    () => dbResource(),
    (db) => db.memosCollection,
  );

  const value: DBContext = {
    rxdb: rxdbResource,
    memosCollection: memosCollectionResource,
  };

  return <DBContext.Provider value={value}>{props.children}</DBContext.Provider>;
};

/**
 * Hook to access RxDB
 */
export function useRxDB(): Resource<NoirNotesDatabase | undefined> {
  const context = useContext(DBContext);
  if (!context) {
    throw new Error("useRxDB must be used within DBProvider");
  }
  return context.rxdb;
}

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
