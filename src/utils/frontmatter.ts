import * as v from "valibot";
import { parse } from "yaml";

import type { MemoFrontmatter } from "../types/memo";

interface ParsedFrontmatter {
  metadata: MemoFrontmatter | undefined;
  contentWithoutFrontmatter: string;
}

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/;

// looseObject preserves unknown keys, matching MemoFrontmatter's [key: string]: unknown
const FrontmatterSchema = v.looseObject({
  title: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
  marp: v.optional(v.boolean()),
});

/**
 * Parse frontmatter from markdown content.
 * Returns validated metadata and content without the frontmatter block.
 */
export function parseFrontmatter(content: string): ParsedFrontmatter {
  const match = FRONTMATTER_REGEX.exec(content);

  if (!match) {
    return { metadata: undefined, contentWithoutFrontmatter: content };
  }

  const yamlString = match[1];
  const contentWithoutFrontmatter = content.slice(match[0].length);

  try {
    const raw = parse(yamlString) as unknown;

    if (!raw || typeof raw !== "object" || Object.keys(raw).length === 0) {
      return { metadata: undefined, contentWithoutFrontmatter: content };
    }

    const result = v.safeParse(FrontmatterSchema, raw);

    if (!result.success) {
      console.warn("[Frontmatter] Invalid frontmatter:", result.issues);
      return { metadata: undefined, contentWithoutFrontmatter: content };
    }

    return { metadata: result.output, contentWithoutFrontmatter };
  } catch (error) {
    console.warn("[Frontmatter] Failed to parse frontmatter:", error);
    return { metadata: undefined, contentWithoutFrontmatter: content };
  }
}

/**
 * Parse and validate a YAML frontmatter string.
 * Used in the markdown preview to render frontmatter metadata.
 */
export const parseFrontmatterYamlString = (yamlString: string) => {
  try {
    const raw = parse(yamlString) as unknown;
    const result = v.safeParse(FrontmatterSchema, raw);

    if (!result.success) {
      console.warn("[Frontmatter] Invalid frontmatter YAML:", result.issues);
      return { success: false as const, issues: result.issues };
    }

    return { success: true as const, data: result.output };
  } catch (error) {
    console.warn("[Frontmatter] Failed to parse frontmatter YAML:", error);
    return { success: false as const, error };
  }
};
