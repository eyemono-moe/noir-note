import { parse, stringify } from "yaml";

import type { MemoWithoutContent } from "../types/memo";

const FRONTMATTER_REGEX = /^(---\r?\n)([\s\S]*?)(\r?\n---)(\r?\n|$)/;

interface EditableFrontmatter {
  title: string;
  tags: string[];
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const normalizeTags = (tags: string[]) =>
  Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );

const stringifyFrontmatter = (metadata: Record<string, unknown>) =>
  stringify(metadata, { lineWidth: 0 }).trimEnd();

const buildEditableMetadata = (
  base: Record<string, unknown>,
  editable: EditableFrontmatter,
): Record<string, unknown> => {
  const next = { ...base };
  const title = editable.title.trim();
  const tags = normalizeTags(editable.tags);

  if (title) next.title = title;
  else delete next.title;

  if (tags.length > 0) next.tags = tags;
  else delete next.tags;

  return next;
};

export function updateEditableFrontmatter(content: string, editable: EditableFrontmatter): string {
  const match = FRONTMATTER_REGEX.exec(content);
  const baseMetadata = match ? parse(match[2]) : undefined;
  const nextMetadata = buildEditableMetadata(
    isPlainRecord(baseMetadata) ? baseMetadata : {},
    editable,
  );
  const body = match ? content.slice(match[0].length) : content;

  if (Object.keys(nextMetadata).length === 0) return body;

  return `---\n${stringifyFrontmatter(nextMetadata)}\n---\n${body}`;
}

export function collectFrontmatterTags(memos: MemoWithoutContent[]): string[] {
  return normalizeTags(memos.flatMap((memo) => memo.metadata?.tags ?? []));
}
