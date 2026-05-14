import type { BaseIssue } from "valibot";

import type { MemoWithoutContent } from "../types/memo";
import { parseFrontmatterYamlString } from "./frontmatter";

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/;

interface BuildNotePropertiesInput {
  memo: MemoWithoutContent;
  content: string;
  backlinks: string[];
}

function formatIssuePath(issue: BaseIssue<unknown>): string {
  const path = issue.path
    ?.map((item) => String(item.key))
    .filter(Boolean)
    .join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

function formatUnknownValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable value]";
  }
}

function formatFrontmatterError(parsed: ReturnType<typeof parseFrontmatterYamlString>): string {
  if (parsed.success) return "";
  if ("issues" in parsed && parsed.issues) {
    return parsed.issues.map(formatIssuePath).join("; ");
  }
  return parsed.error instanceof Error ? parsed.error.message : "Failed to parse frontmatter";
}

export function buildNoteProperties(input: BuildNotePropertiesInput) {
  const match = FRONTMATTER_REGEX.exec(input.content);

  const base = {
    system: {
      path: input.memo.path,
      createdAtIso: new Date(input.memo.createdAt).toISOString(),
      updatedAtIso: new Date(input.memo.updatedAt).toISOString(),
    },
    backlinks: {
      paths: input.backlinks,
    },
  };

  if (!match) {
    return {
      ...base,
      frontmatter: {
        status: "absent" as const,
        title: undefined,
        tags: [],
        extraFields: [],
      },
    };
  }

  const parsed = parseFrontmatterYamlString(match[1]);

  if (!parsed.success) {
    return {
      ...base,
      frontmatter: {
        status: "invalid" as const,
        title: undefined,
        tags: [],
        extraFields: [],
        message: formatFrontmatterError(parsed),
      },
    };
  }

  const metadata = parsed.data;
  const extraFields = Object.entries(metadata)
    .filter(([key]) => key !== "title" && key !== "tags")
    .map(([key, value]) => ({ key, value: formatUnknownValue(value) }))
    .sort((a, b) => a.key.localeCompare(b.key));

  return {
    ...base,
    frontmatter: {
      status: "valid" as const,
      title: metadata.title,
      tags: metadata.tags ?? [],
      extraFields,
    },
  };
}
