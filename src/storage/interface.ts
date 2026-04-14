import type { Memo } from "../types/memo";

export interface IStorage {
  get(path: string): Promise<Memo | null>;
  set(path: string, content: string): Promise<void>;
  delete(path: string): Promise<void>;
  list(): Promise<Memo[]>;
  clear(): Promise<void>;
}
