import { describe, expect, test } from "vite-plus/test";
import { normalizePath, getParentPath, getPathSegments, isChildPath } from "./path";

describe("normalizePath", () => {
  test("should add leading slash if missing", () => {
    expect(normalizePath("foo")).toBe("/foo");
    expect(normalizePath("foo/bar")).toBe("/foo/bar");
  });

  test("should keep leading slash if present", () => {
    expect(normalizePath("/foo")).toBe("/foo");
    expect(normalizePath("/foo/bar")).toBe("/foo/bar");
  });

  test("should remove trailing slash", () => {
    expect(normalizePath("/foo/")).toBe("/foo");
    expect(normalizePath("/foo/bar/")).toBe("/foo/bar");
  });

  test("should handle root path", () => {
    expect(normalizePath("/")).toBe("/");
  });

  test("should handle empty string as root", () => {
    expect(normalizePath("")).toBe("/");
  });

  test("should handle complex paths", () => {
    expect(normalizePath("foo/bar/baz")).toBe("/foo/bar/baz");
    expect(normalizePath("/foo/bar/baz/")).toBe("/foo/bar/baz");
  });
});

describe("getParentPath", () => {
  test("should return null for root path", () => {
    expect(getParentPath("/")).toBeNull();
  });

  test("should return root for top-level paths", () => {
    expect(getParentPath("/foo")).toBe("/");
    expect(getParentPath("/bar")).toBe("/");
  });

  test("should return parent path for nested paths", () => {
    expect(getParentPath("/foo/bar")).toBe("/foo");
    expect(getParentPath("/foo/bar/baz")).toBe("/foo/bar");
  });

  test("should handle paths without leading slash", () => {
    expect(getParentPath("foo")).toBe("/");
    expect(getParentPath("foo/bar")).toBe("/foo");
  });

  test("should handle paths with trailing slash", () => {
    expect(getParentPath("/foo/bar/")).toBe("/foo");
  });
});

describe("getPathSegments", () => {
  test("should return empty array for root path", () => {
    expect(getPathSegments("/")).toEqual([]);
  });

  test("should split path into segments", () => {
    expect(getPathSegments("/foo")).toEqual(["foo"]);
    expect(getPathSegments("/foo/bar")).toEqual(["foo", "bar"]);
    expect(getPathSegments("/foo/bar/baz")).toEqual(["foo", "bar", "baz"]);
  });

  test("should handle paths without leading slash", () => {
    expect(getPathSegments("foo")).toEqual(["foo"]);
    expect(getPathSegments("foo/bar")).toEqual(["foo", "bar"]);
  });

  test("should handle paths with trailing slash", () => {
    expect(getPathSegments("/foo/bar/")).toEqual(["foo", "bar"]);
  });

  test("should handle empty string as root", () => {
    expect(getPathSegments("")).toEqual([]);
  });
});

describe("isChildPath", () => {
  test("should return true for direct children", () => {
    expect(isChildPath("/", "/foo")).toBe(true);
    expect(isChildPath("/foo", "/foo/bar")).toBe(true);
    expect(isChildPath("/foo/bar", "/foo/bar/baz")).toBe(true);
  });

  test("should return true for nested descendants", () => {
    expect(isChildPath("/", "/foo/bar/baz")).toBe(true);
    expect(isChildPath("/foo", "/foo/bar/baz/qux")).toBe(true);
  });

  test("should return false for same path", () => {
    expect(isChildPath("/", "/")).toBe(false);
    expect(isChildPath("/foo", "/foo")).toBe(false);
    expect(isChildPath("/foo/bar", "/foo/bar")).toBe(false);
  });

  test("should return false for siblings", () => {
    expect(isChildPath("/foo", "/bar")).toBe(false);
    expect(isChildPath("/foo/bar", "/foo/baz")).toBe(false);
  });

  test("should return false for parent paths", () => {
    expect(isChildPath("/foo/bar", "/foo")).toBe(false);
    expect(isChildPath("/foo", "/")).toBe(false);
  });

  test("should handle paths with similar names", () => {
    // /foobar is not a child of /foo
    expect(isChildPath("/foo", "/foobar")).toBe(false);
    // /foo/bar is a child of /foo
    expect(isChildPath("/foo", "/foo/bar")).toBe(true);
  });

  test("should handle paths without leading slash", () => {
    expect(isChildPath("foo", "foo/bar")).toBe(true);
    expect(isChildPath("foo", "bar")).toBe(false);
  });

  test("should handle paths with trailing slash", () => {
    expect(isChildPath("/foo/", "/foo/bar")).toBe(true);
    expect(isChildPath("/foo", "/foo/bar/")).toBe(true);
  });
});
