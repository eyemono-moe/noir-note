import type { EditorView } from "@codemirror/view";
import { useLocation, useNavigate } from "@solidjs/router";
import { useLiveQuery } from "@tanstack/solid-db";
import { type Component, createMemo, createSignal, lazy, Show, Suspense } from "solid-js";

import SplitView from "../components/Layout/SplitView";
import { useMemosCollection } from "../context/db";
import { useEditorSplit } from "../context/editorSplit";
import { useCheckboxSync } from "../hooks/useCheckboxSync";
import { useMemoContent, useMemoSaver } from "../hooks/useMemoOperations";
import { useScrollSync } from "../hooks/useScrollSync";
import { useScrollSyncEnabled } from "../store/configStore";
import { normalizePath } from "../utils/path";

const Editor = lazy(() => import("../components/Editor/Editor"));
const MarkdownRenderer = lazy(() => import("../components/Preview/MarkdownRenderer"));
const Sidebar = lazy(() => import("../components/Sidebar/Sidebar"));

const MemoPage: Component = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const editorSplitter = useEditorSplit();

  // Get memos collection
  const memosCollectionResource = useMemosCollection();

  // Get current path from URL
  const currentPath = createMemo(() => normalizePath(location.pathname));

  // Use memo operations hooks
  const {
    content: localContent,
    setContent: setLocalContent,
    isReady,
    // oxlint-disable-next-line solid/reactivity
  } = useMemoContent(currentPath);
  const { save: debouncedSave } = useMemoSaver();

  // Handle content changes from the editor (user typing)
  const handleContentChange = (newContent: string) => {
    setLocalContent(newContent);
    debouncedSave(currentPath(), newContent);
  };

  // ── Editor / preview refs ─────────────────────────────────────────────────
  // `editorView` holds the CodeMirror EditorView instance. EditorView is a
  // class (not a function), so SolidJS will not misinterpret it as a functional
  // updater when passed to the signal setter.
  const [editorView, setEditorView] = createSignal<EditorView | undefined>();
  const [previewContainer, setPreviewContainer] = createSignal<HTMLElement | undefined>();
  // ─────────────────────────────────────────────────────────────────────────

  // ── Scroll sync ───────────────────────────────────────────────────────────
  const scrollSyncEnabled = useScrollSyncEnabled();
  // oxlint-disable-next-line solid/reactivity
  useScrollSync(editorView, previewContainer, scrollSyncEnabled);
  // ─────────────────────────────────────────────────────────────────────────

  // Handle task list checkbox toggle from the preview
  // oxlint-disable-next-line solid/reactivity
  const handleCheckboxToggle = useCheckboxSync(editorView);

  // All memos query for sidebar and command palette
  const allMemosQuery = useLiveQuery((q) => {
    const collection = memosCollectionResource();
    if (!collection) return null;
    return q.from({ memos: collection }).select(({ memos }) => ({
      path: memos.path,
      title: memos.metadata?.title,
      metadata: memos.metadata,
      createdAt: memos.createdAt,
      updatedAt: memos.updatedAt,
    }));
  });

  return (
    <main>
      <Show
        when={memosCollectionResource() && allMemosQuery.isReady}
        fallback={
          <div class="flex h-screen w-screen items-center justify-center">
            <div class="text-text-secondary text-lg">Initializing database...</div>
          </div>
        }
      >
        <div class="bg-surface-primary text-text-primary h-screen w-screen overflow-hidden">
          <SplitView
            splitter={editorSplitter}
            left={
              <Suspense fallback={<div class="text-text-secondary p-4">Loading sidebar...</div>}>
                <Sidebar
                  currentPath={currentPath()}
                  onNavigate={(path) => navigate(path)}
                  onDelete={(path) => {
                    const collection = memosCollectionResource();
                    if (collection) {
                      collection.delete(path); // Optimistic delete
                    }
                  }}
                  onInsert={(memo) => {
                    const collection = memosCollectionResource();
                    if (collection) {
                      const now = Date.now();
                      collection.insert({ ...memo, content: "", createdAt: now, updatedAt: now }); // Optimistic insert
                    }
                  }}
                  allMemos={allMemosQuery() || []}
                  memosCollection={memosCollectionResource()!}
                />
              </Suspense>
            }
            center={
              <Show when={isReady()}>
                <Suspense fallback={<div class="text-text-secondary p-4">Loading editor...</div>}>
                  <Editor
                    content={localContent()}
                    onChange={handleContentChange}
                    placeholder="Start typing..."
                    onEditorView={setEditorView}
                  />
                </Suspense>
              </Show>
            }
            right={
              <Show when={isReady()}>
                <Suspense fallback={<div class="text-text-secondary p-4">Loading preview...</div>}>
                  <MarkdownRenderer
                    content={localContent()}
                    onCheckboxToggle={handleCheckboxToggle}
                    containerRef={setPreviewContainer}
                  />
                </Suspense>
              </Show>
            }
          />
        </div>
      </Show>
    </main>
  );
};

export default MemoPage;
