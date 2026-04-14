export function normalizePath(path: string): string {
  // Ensure path starts with /
  let normalized = path.startsWith("/") ? path : `/${path}`;

  // Remove trailing slash (except for root)
  if (normalized !== "/" && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

export function getParentPath(path: string): string | null {
  const normalized = normalizePath(path);
  if (normalized === "/") {
    return null;
  }

  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash === 0) {
    return "/";
  }

  return normalized.slice(0, lastSlash);
}

export function getPathSegments(path: string): string[] {
  const normalized = normalizePath(path);
  if (normalized === "/") {
    return [];
  }

  return normalized.slice(1).split("/");
}

export function isChildPath(parentPath: string, childPath: string): boolean {
  const normalizedParent = normalizePath(parentPath);
  const normalizedChild = normalizePath(childPath);

  if (normalizedParent === normalizedChild) {
    return false;
  }

  // Special case for root path
  if (normalizedParent === "/") {
    return normalizedChild.startsWith("/") && normalizedChild !== "/";
  }

  return normalizedChild.startsWith(`${normalizedParent}/`);
}
