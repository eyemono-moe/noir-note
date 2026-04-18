import { describe, expect, test } from "vite-plus/test";

import type { Memo } from "../types/memo";
import { buildTree, findNodeByPath, getAllPaths } from "./tree";

function createMemo(path: string, content = ""): Memo {
  return {
    path,
    content,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe("buildTree", () => {
  test("empty array returns empty tree", () => {
    const tree = buildTree([]);
    expect(tree).toEqual([]);
  });

  test("root memo only", () => {
    const memos = [createMemo("/", "Root content")];
    const tree = buildTree(memos);

    expect(tree).toHaveLength(1);
    expect(tree[0].path).toBe("/");
    expect(tree[0].name).toBe("/");
    expect(tree[0].memo?.content).toBe("Root content");
    expect(tree[0].children).toEqual([]);
  });

  test("single child of root", () => {
    const memos = [createMemo("/foo", "Foo content")];
    const tree = buildTree(memos);

    expect(tree).toHaveLength(1);
    expect(tree[0].path).toBe("/foo");
    expect(tree[0].name).toBe("foo");
    expect(tree[0].memo?.content).toBe("Foo content");
  });

  test("root memo with children", () => {
    const memos = [createMemo("/", "Root"), createMemo("/foo", "Foo")];
    const tree = buildTree(memos);

    expect(tree).toHaveLength(1);

    // Root node
    const rootNode = tree.find((n) => n.path === "/");
    expect(rootNode).toBeDefined();
    expect(rootNode?.memo?.content).toBe("Root");

    // Child node
    const fooNode = rootNode?.children.find((n) => n.path === "/foo");
    expect(fooNode).toBeDefined();
    expect(fooNode?.memo?.content).toBe("Foo");

    // Root should have foo as child
    expect(rootNode?.children).toHaveLength(1);
    expect(rootNode?.children[0].path).toBe("/foo");
  });

  test("nested paths create intermediate nodes", () => {
    const memos = [createMemo("/foo/bar/baz", "Deep content")];
    const tree = buildTree(memos);

    expect(tree).toHaveLength(1);
    expect(tree[0].path).toBe("/foo");
    expect(tree[0].name).toBe("foo");
    expect(tree[0].memo).toBeUndefined(); // No memo for /foo

    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].path).toBe("/foo/bar");
    expect(tree[0].children[0].memo).toBeUndefined(); // No memo for /foo/bar

    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].path).toBe("/foo/bar/baz");
    expect(tree[0].children[0].children[0].memo?.content).toBe("Deep content");
  });

  test("multiple children at same level", () => {
    const memos = [createMemo("/foo", "Foo"), createMemo("/bar", "Bar"), createMemo("/baz", "Baz")];
    const tree = buildTree(memos);

    expect(tree).toHaveLength(3);
    expect(tree.map((n) => n.path).sort()).toEqual(["/bar", "/baz", "/foo"]);
  });

  test("complex tree structure", () => {
    const memos = [
      createMemo("/", "Root"),
      createMemo("/foo", "Foo"),
      createMemo("/foo/bar", "Bar"),
      createMemo("/foo/baz", "Baz"),
      createMemo("/qux", "Qux"),
    ];
    const tree = buildTree(memos);

    expect(tree).toHaveLength(1); // `/`

    const rootNode = tree.find((n) => n.path === "/");
    expect(rootNode?.memo?.content).toBe("Root");
    expect(rootNode?.children).toHaveLength(2);

    const fooNode = rootNode?.children.find((n) => n.path === "/foo");
    expect(fooNode?.memo?.content).toBe("Foo");
    expect(fooNode?.children).toHaveLength(2);

    const quxNode = rootNode?.children.find((n) => n.path === "/qux");
    expect(quxNode?.memo?.content).toBe("Qux");
  });

  test("memo added to existing intermediate node", () => {
    const memos = [createMemo("/foo/bar", "Bar"), createMemo("/foo", "Foo")];
    const tree = buildTree(memos);

    expect(tree).toHaveLength(1);
    expect(tree[0].path).toBe("/foo");
    expect(tree[0].memo?.content).toBe("Foo"); // Memo added to previously intermediate node
    expect(tree[0].children[0].memo?.content).toBe("Bar");
  });
});

describe("findNodeByPath", () => {
  test("find root node", () => {
    const memos = [createMemo("/", "Root"), createMemo("/foo", "Foo")];
    const tree = buildTree(memos);

    const node = findNodeByPath(tree, "/");
    expect(node?.path).toBe("/");
    expect(node?.memo?.content).toBe("Root");
  });

  test("find child node", () => {
    const memos = [createMemo("/foo", "Foo"), createMemo("/foo/bar", "Bar")];
    const tree = buildTree(memos);

    const node = findNodeByPath(tree, "/foo/bar");
    expect(node?.path).toBe("/foo/bar");
    expect(node?.memo?.content).toBe("Bar");
  });

  test("return null for non-existent path", () => {
    const memos = [createMemo("/foo", "Foo")];
    const tree = buildTree(memos);

    const node = findNodeByPath(tree, "/bar");
    expect(node).toBeNull();
  });

  test("find intermediate node without memo", () => {
    const memos = [createMemo("/foo/bar/baz", "Baz")];
    const tree = buildTree(memos);

    const node = findNodeByPath(tree, "/foo/bar");
    expect(node?.path).toBe("/foo/bar");
    expect(node?.memo).toBeUndefined();
  });
});

describe("getAllPaths", () => {
  test("empty tree returns empty array", () => {
    const paths = getAllPaths([]);
    expect(paths).toEqual([]);
  });

  test("returns all paths including intermediate nodes", () => {
    const memos = [
      createMemo("/", "Root"),
      createMemo("/foo/bar", "Bar"),
      createMemo("/baz", "Baz"),
    ];
    const tree = buildTree(memos);

    const paths = getAllPaths(tree);
    expect(paths.sort()).toEqual(["/", "/baz", "/foo", "/foo/bar"].sort());
  });

  test("deep nesting", () => {
    const memos = [createMemo("/a/b/c/d/e", "Deep")];
    const tree = buildTree(memos);

    const paths = getAllPaths(tree);
    expect(paths).toEqual(["/a", "/a/b", "/a/b/c", "/a/b/c/d", "/a/b/c/d/e"]);
  });
});
