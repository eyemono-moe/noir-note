import { createContext, useContext, type ParentComponent } from "solid-js";

import { createStorage, type IStorage } from "../storage";

const StorageContext = createContext<IStorage>();

export const StorageProvider: ParentComponent = (props) => {
  const storage = createStorage();
  return <StorageContext.Provider value={storage}>{props.children}</StorageContext.Provider>;
};

export const useStorage = () => {
  const context = useContext(StorageContext);
  if (context === undefined) {
    throw new Error("useStorage must be used within a StorageProvider");
  }
  return context;
};
