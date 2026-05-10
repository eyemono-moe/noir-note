import { describe, expect, test } from "vite-plus/test";

import { extractMemoLinks, resolveMemoLinkTarget } from "./noteLinks";

describe("resolveMemoLinkTarget", () => {
  test("returns null for absolute external URLs", () => {
    expect(resolveMemoLinkTarget("https://example.com/a", "/")).toBeNull();
    expect(resolveMemoLinkTarget("http://x.test", "/foo")).toBeNull();
    expect(resolveMemoLinkTarget("mailto:a@b.c", "/foo")).toBeNull();
  });

  test("returns null for attachment scheme", () => {
    expect(resolveMemoLinkTarget("attachment://abc", "/foo")).toBeNull();
  });

  test("returns null for empty / hash-only urls", () => {
    expect(resolveMemoLinkTarget("", "/foo")).toBeNull();
    expect(resolveMemoLinkTarget("#section", "/foo")).toBeNull();
  });

  test("resolves absolute memo paths", () => {
    expect(resolveMemoLinkTarget("/bar", "/foo")).toBe("/bar");
    expect(resolveMemoLinkTarget("/a/b", "/foo/baz")).toBe("/a/b");
  });

  test("resolves relative ./ links from a top-level note", () => {
    // sibling of /foo
    expect(resolveMemoLinkTarget("./bar", "/foo")).toBe("/bar");
  });

  test("resolves relative ./ links from a nested note", () => {
    // /a/b -> ./c => /a/c
    expect(resolveMemoLinkTarget("./c", "/a/b")).toBe("/a/c");
  });

  test("resolves bare relative links", () => {
    expect(resolveMemoLinkTarget("bar", "/foo")).toBe("/bar");
    expect(resolveMemoLinkTarget("c", "/a/b")).toBe("/a/c");
  });

  test("resolves ../ relative links", () => {
    expect(resolveMemoLinkTarget("../sibling", "/a/b")).toBe("/sibling");
    expect(resolveMemoLinkTarget("../../top", "/a/b/c")).toBe("/top");
  });

  test("strips hash and query from target", () => {
    expect(resolveMemoLinkTarget("/bar#h", "/")).toBe("/bar");
    expect(resolveMemoLinkTarget("./bar?x=1", "/foo")).toBe("/bar");
  });

  test("normalizes trailing slash", () => {
    expect(resolveMemoLinkTarget("/bar/", "/foo")).toBe("/bar");
  });

  test("returns / for parent-of-root edge", () => {
    expect(resolveMemoLinkTarget("./", "/foo")).toBe("/");
  });
});

describe("extractMemoLinks", () => {
  test("returns empty array for content without links", () => {
    expect(extractMemoLinks("# Hello\n\nNo links.", "/foo")).toEqual([]);
  });

  test("extracts inline markdown link targets", () => {
    const md = "See [bar](./bar) and [baz](/a/baz).";
    expect(extractMemoLinks(md, "/foo")).toEqual(["/bar", "/a/baz"]);
  });

  test("extracts reference-style link definitions", () => {
    const md = "See [bar][b].\n\n[b]: ./bar";
    expect(extractMemoLinks(md, "/foo")).toEqual(["/bar"]);
  });

  test("excludes external links", () => {
    const md = "[ext](https://example.com) and [n](./bar)";
    expect(extractMemoLinks(md, "/foo")).toEqual(["/bar"]);
  });

  test("excludes attachment:// links", () => {
    const md = "![pic](attachment://uuid-pic.png) and [n](./bar)";
    expect(extractMemoLinks(md, "/foo")).toEqual(["/bar"]);
  });

  test("dedupes repeated links to the same target", () => {
    const md = "[a](./bar) [b](./bar) [c](/bar)";
    expect(extractMemoLinks(md, "/foo")).toEqual(["/bar"]);
  });

  test("excludes self-links", () => {
    const md = "[me](/foo) [other](./bar)";
    expect(extractMemoLinks(md, "/foo")).toEqual(["/bar"]);
  });

  test("ignores frontmatter content", () => {
    const md = "---\ntitle: Hello\n---\n[bar](./bar)";
    expect(extractMemoLinks(md, "/foo")).toEqual(["/bar"]);
  });
});
