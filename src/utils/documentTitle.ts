import { createEffect, onCleanup, type Accessor } from "solid-js";

import { parseFrontmatter } from "./frontmatter";
import { normalizePath } from "./path";

const APP_DOCUMENT_TITLE = "eyemono.md";

export function getMemoDocumentTitle(path: string, frontmatterTitle?: string): string {
  const normalizedPath = normalizePath(path);
  if (normalizedPath === "/") {
    return APP_DOCUMENT_TITLE;
  }

  const title = frontmatterTitle?.trim();
  const noteTitle = title || normalizedPath;

  return `${noteTitle} — ${APP_DOCUMENT_TITLE}`;
}

export function useMemoDocumentTitle(path: Accessor<string>, content: Accessor<string>) {
  createEffect(() => {
    const { metadata } = parseFrontmatter(content());
    document.title = getMemoDocumentTitle(path(), metadata?.title);
  });

  onCleanup(() => {
    document.title = APP_DOCUMENT_TITLE;
  });
}
