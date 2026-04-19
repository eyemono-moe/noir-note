import { getPathSegments } from "./path";

export interface TreeNode {
  path: string;
  name: string;
  children: TreeNode[];
}

export function buildTree(memos: { path: string }[]): TreeNode[] {
  const root: TreeNode[] = [];
  const nodeMap = new Map<string, TreeNode>();

  // Sort memos by path to ensure parent paths are processed first
  const sortedMemos = [...memos].sort((a, b) => a.path.localeCompare(b.path));

  for (const memo of sortedMemos) {
    const segments = getPathSegments(memo.path);

    // Special case: root path "/"
    if (segments.length === 0) {
      const rootNode: TreeNode = {
        path: "/",
        name: "/",
        children: [],
      };
      nodeMap.set("/", rootNode);
      // Don't add to root yet - we'll handle it at the end
      continue;
    }

    // Build the path from root to this node
    let currentPath = "";
    let currentLevel = root;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      currentPath = currentPath ? `${currentPath}/${segment}` : `/${segment}`;

      // Check if node already exists
      let node = nodeMap.get(currentPath);

      if (!node) {
        // Create new node
        node = {
          path: currentPath,
          name: segment,
          children: [],
        };

        nodeMap.set(currentPath, node);
        currentLevel.push(node);
      }

      // Move to next level
      currentLevel = node.children;
    }
  }

  // If "/" node exists, make it the root and move all top-level nodes as its children
  const rootSlashNode = nodeMap.get("/");
  if (rootSlashNode) {
    // Move all current top-level nodes to be children of "/"
    rootSlashNode.children = root;
    return [rootSlashNode];
  }

  return root;
}

export function findNodeByPath(tree: TreeNode[], path: string): TreeNode | null {
  for (const node of tree) {
    if (node.path === path) {
      return node;
    }

    const found = findNodeByPath(node.children, path);
    if (found) {
      return found;
    }
  }

  return null;
}

export function getAllPaths(tree: TreeNode[]): string[] {
  const paths: string[] = [];

  function traverse(nodes: TreeNode[]) {
    for (const node of nodes) {
      paths.push(node.path);
      traverse(node.children);
    }
  }

  traverse(tree);
  return paths;
}
