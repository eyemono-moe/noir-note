import matter from "gray-matter";

import type { MemoFrontmatter } from "../types/memo";

/**
 * Parse frontmatter from markdown content
 * Returns parsed metadata and content without frontmatter
 */
interface ParsedFrontmatter {
  metadata: MemoFrontmatter | undefined;
  contentWithoutFrontmatter: string;
}

export function parseFrontmatter(content: string): ParsedFrontmatter {
  try {
    const parsed = matter(content);

    // If no frontmatter found, return undefined metadata
    if (!parsed.data || Object.keys(parsed.data).length === 0) {
      return {
        metadata: undefined,
        contentWithoutFrontmatter: content,
      };
    }

    // Extract and validate metadata fields
    const metadata: MemoFrontmatter = {
      ...(parsed.data as Record<string, unknown>),
    };

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
      contentWithoutFrontmatter: parsed.content,
    };
  } catch (error) {
    console.error("[Frontmatter] Failed to parse frontmatter:", error);
    return {
      metadata: undefined,
      contentWithoutFrontmatter: content,
    };
  }
}

// /**
//  * Check if content has frontmatter
//  */
// export function hasFrontmatter(content: string): boolean {
//   return content.trimStart().startsWith("---");
// }

// /**
//  * Strip frontmatter from content (utility for display)
//  * Removes the YAML frontmatter block entirely
//  */
// export function stripFrontmatter(content: string): string {
//   const { contentWithoutFrontmatter } = parseFrontmatter(content);
//   return contentWithoutFrontmatter;
// }
