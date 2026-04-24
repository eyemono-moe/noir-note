import * as v from "valibot";
import { parse } from "yaml";

import type { MemoFrontmatter } from "../types/memo";
/**
 * Parse frontmatter from markdown content
 * Returns parsed metadata and content without frontmatter
 */
interface ParsedFrontmatter {
  metadata: MemoFrontmatter | undefined;
  contentWithoutFrontmatter: string;
}

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/;

export function parseFrontmatter(content: string): ParsedFrontmatter {
  try {
    const match = FRONTMATTER_REGEX.exec(content);

    if (!match) {
      return {
        metadata: undefined,
        contentWithoutFrontmatter: content,
      };
    }

    const yamlString = match[1];
    const contentWithoutFrontmatter = content.slice(match[0].length);

    const data = parse(yamlString) as Record<string, unknown> | null | undefined;

    if (!data || typeof data !== "object" || Object.keys(data).length === 0) {
      return {
        metadata: undefined,
        contentWithoutFrontmatter: content,
      };
    }

    // Extract and validate metadata fields
    const metadata: MemoFrontmatter = { ...data };

    // Validate specific fields if present
    if (metadata.tags && !Array.isArray(metadata.tags)) {
      console.warn("[Frontmatter] Invalid tags format, expected array");
      metadata.tags = [];
    }

    if (metadata.title && typeof metadata.title !== "string") {
      console.warn("[Frontmatter] Invalid title format, expected string");
      metadata.title = String(metadata.title);
    }

    return {
      metadata,
      contentWithoutFrontmatter,
    };
  } catch (error) {
    console.warn("[Frontmatter] Failed to parse frontmatter:", error);
    return {
      metadata: undefined,
      contentWithoutFrontmatter: content,
    };
  }
}

const FrontmatterSchema = v.object({
  title: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
});

export const parseFrontmatterYamlString = (yamlString: string) => {
  try {
    const parsed = parse(yamlString);
    return { success: true, data: v.parse(FrontmatterSchema, parsed) };
  } catch (error) {
    console.warn("[Frontmatter] Failed to parse YAML frontmatter:", error);
    return { success: false, error };
  }
};
