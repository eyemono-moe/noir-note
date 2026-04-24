import { describe, expect, test } from "vite-plus/test";

import { parseFrontmatter, parseFrontmatterYamlString } from "./frontmatter";

describe("parseFrontmatter", () => {
  test("returns undefined metadata and original content when no frontmatter", () => {
    const content = "# Hello\n\nSome content.";
    const result = parseFrontmatter(content);
    expect(result.metadata).toBeUndefined();
    expect(result.contentWithoutFrontmatter).toBe(content);
  });

  test("parses basic frontmatter with title and tags", () => {
    const content = "---\ntitle: My Note\ntags:\n  - foo\n  - bar\n---\n# Body";
    const result = parseFrontmatter(content);
    expect(result.metadata?.title).toBe("My Note");
    expect(result.metadata?.tags).toEqual(["foo", "bar"]);
    expect(result.contentWithoutFrontmatter).toBe("# Body");
  });

  test("strips the frontmatter block from contentWithoutFrontmatter", () => {
    const content = "---\ntitle: Test\n---\nActual content";
    const result = parseFrontmatter(content);
    expect(result.contentWithoutFrontmatter).toBe("Actual content");
  });

  test("handles CRLF line endings in frontmatter", () => {
    const content = "---\r\ntitle: CRLF Note\r\n---\r\nBody";
    const result = parseFrontmatter(content);
    expect(result.metadata?.title).toBe("CRLF Note");
    expect(result.contentWithoutFrontmatter).toBe("Body");
  });

  test("returns undefined metadata when frontmatter block is empty", () => {
    const content = "---\n---\nContent";
    const result = parseFrontmatter(content);
    expect(result.metadata).toBeUndefined();
  });

  test("returns original content when frontmatter is not at the start", () => {
    const content = "Some text\n---\ntitle: Test\n---\n";
    const result = parseFrontmatter(content);
    expect(result.metadata).toBeUndefined();
    expect(result.contentWithoutFrontmatter).toBe(content);
  });

  test("handles frontmatter with no trailing content", () => {
    const content = "---\ntitle: Only FM\n---\n";
    const result = parseFrontmatter(content);
    expect(result.metadata?.title).toBe("Only FM");
    expect(result.contentWithoutFrontmatter).toBe("");
  });

  test("coerces non-string title to string and warns", () => {
    const content = "---\ntitle: 42\n---\n";
    const result = parseFrontmatter(content);
    expect(result.metadata?.title).toBe("42");
  });

  test("resets invalid tags to empty array and warns", () => {
    const content = "---\ntags: not-an-array\n---\n";
    const result = parseFrontmatter(content);
    expect(result.metadata?.tags).toEqual([]);
  });

  test("preserves arbitrary extra metadata fields", () => {
    const content = "---\ntitle: Extra\ncustom: value\n---\n";
    const result = parseFrontmatter(content);
    expect((result.metadata as Record<string, unknown>)?.custom).toBe("value");
  });
});

describe("parseFrontmatterYamlString", () => {
  test("parses valid YAML string", () => {
    const result = parseFrontmatterYamlString("title: Hello\ntags:\n  - a\n  - b");
    expect(result.success).toBe(true);
    expect(result.data?.title).toBe("Hello");
    expect(result.data?.tags).toEqual(["a", "b"]);
  });

  test("returns success false for invalid YAML", () => {
    const result = parseFrontmatterYamlString(": invalid: yaml: [");
    expect(result.success).toBe(false);
  });

  test("returns success false when schema validation fails (tags not array)", () => {
    const result = parseFrontmatterYamlString("tags: not-an-array");
    expect(result.success).toBe(false);
  });

  test("returns success false for empty string (yaml parses to null)", () => {
    const result = parseFrontmatterYamlString("");
    expect(result.success).toBe(false);
  });
});
