import type { Memo, MemoFrontmatter } from "../types/memo";

export type SearchIndexUpdatePlan =
  | { type: "rebuild"; documents: Memo[] }
  | { type: "incremental"; updates: Memo[]; removals: string[] };

function toSearchMetadata(metadata: MemoFrontmatter | undefined): MemoFrontmatter | undefined {
  const title = typeof metadata?.title === "string" ? metadata.title : undefined;
  const tags = Array.isArray(metadata?.tags)
    ? metadata.tags.filter((tag): tag is string => typeof tag === "string")
    : undefined;

  if (!title && (!tags || tags.length === 0)) {
    return undefined;
  }

  return {
    ...(title ? { title } : {}),
    ...(tags && tags.length > 0 ? { tags: [...tags] } : {}),
  };
}

export function toSearchDocuments(memos: readonly Memo[]): Memo[] {
  return memos.map((memo) => ({
    path: memo.path,
    content: memo.content,
    createdAt: memo.createdAt,
    updatedAt: memo.updatedAt,
    metadata: toSearchMetadata(memo.metadata),
  }));
}

export function planSearchIndexUpdates(
  previousUpdatedAtByPath: ReadonlyMap<string, number>,
  documents: readonly Memo[],
  hasBuiltIndex: boolean,
): SearchIndexUpdatePlan {
  if (!hasBuiltIndex) {
    return { type: "rebuild", documents: [...documents] };
  }

  const nextUpdatedAtByPath = new Map(
    documents.map((document) => [document.path, document.updatedAt]),
  );
  const updates = documents.filter(
    (document) => previousUpdatedAtByPath.get(document.path) !== document.updatedAt,
  );
  const removals = [...previousUpdatedAtByPath.keys()].filter(
    (path) => !nextUpdatedAtByPath.has(path),
  );

  return { type: "incremental", updates, removals };
}

export function toUpdatedAtMap(documents: readonly Memo[]): Map<string, number> {
  return new Map(documents.map((document) => [document.path, document.updatedAt]));
}
