import { useNavigate } from "@solidjs/router";
import { useLiveQuery } from "@tanstack/solid-db";
import {
  type Component,
  createDeferred,
  createEffect,
  lazy,
  Show,
  Suspense,
  on,
  untrack,
} from "solid-js";

import SplitView from "../components/Layout/SplitView";
import { CurrentMemoProvider, useCurrentMemo } from "../context/currentMemo";
import { useMemosCollection } from "../context/db";
import { EditorProvider, useEditorContext } from "../context/editor";
import { EditorCacheProvider, useEditorStateCache } from "../context/editorCacheContext";
import { useEditorSplit } from "../context/editorSplit";
import { useCheckboxSync } from "../hooks/useCheckboxSync";
import { useMemoSaver } from "../hooks/useMemoOperations";
import { useScrollSync } from "../hooks/useScrollSync";
import { useScrollSyncEnabled } from "../store/configStore";

// Start downloading the Editor chunk immediately at module-evaluation time,
// before the DB sync completes. This overlaps the network download with DB
// initialization so the editor can mount as soon as isReady() becomes true.
const editorImport = import("../components/Editor/Editor");
const Editor = lazy(() => editorImport);
const MarkdownRenderer = lazy(() => import("../components/Preview/MarkdownRenderer"));
const Sidebar = lazy(() => import("../components/Sidebar/Sidebar"));

const MemoPageContent: Component = () => {
  const navigate = useNavigate();
  const editorSplitter = useEditorSplit();
  const collection = useMemosCollection();

  const { path: currentPath, content, setContent, isReady } = useCurrentMemo();
  const { editorView, setEditorView, previewContainer, setPreviewContainer } = useEditorContext();
  const cache = useEditorStateCache();

  // Defer preview updates so editor keystrokes are never blocked by the
  // markdown parse + render pipeline. The preview catches up within 300 ms
  // of the last change (or sooner during browser idle time).
  const deferredContent = createDeferred(content, { timeoutMs: 300 });

  const { save: debouncedSave } = useMemoSaver();
  let previousPath: string | null = null;

  // Only react when the memo path changes (avoid reacting to editorView() changes)
  createEffect(
    on(currentPath, (newPath: string, oldPath: string | undefined) => {
      // run without tracking editorView changes
      untrack(() => {
        const view = editorView();
        if (!view) return;

        const prev = previousPath ?? oldPath ?? null;
        previousPath = newPath;

        if (prev && prev !== newPath) {
          cache.save(prev, view.state);
        }

        // Try to restore; if none, noop.
        const restored = cache.load(newPath);
        if (restored) {
          view.setState(restored);
        }
      });
    }),
  );

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    debouncedSave(currentPath(), newContent);
  };

  const scrollSyncEnabled = useScrollSyncEnabled();
  // oxlint-disable-next-line solid/reactivity
  useScrollSync(editorView, previewContainer, scrollSyncEnabled);

  // oxlint-disable-next-line solid/reactivity
  const handleCheckboxToggle = useCheckboxSync(editorView);

  const allMemosQuery = useLiveQuery((q) =>
    q.from({ memos: collection }).select(({ memos }) => ({
      path: memos.path,
      title: memos.metadata?.title,
      metadata: memos.metadata,
      createdAt: memos.createdAt,
      updatedAt: memos.updatedAt,
    })),
  );

  return (
    <div class="bg-surface-primary text-text-primary h-screen w-screen overflow-hidden">
      <SplitView
        splitter={editorSplitter}
        left={
          <Suspense fallback={<div class="text-text-secondary p-4">Loading sidebar...</div>}>
            <Sidebar
              currentPath={currentPath()}
              onNavigate={(path) => navigate(path)}
              onDelete={(path) => {
                collection.delete(path);
              }}
              onInsert={(memo) => {
                const now = Date.now();
                collection.insert({ ...memo, content: "", createdAt: now, updatedAt: now });
              }}
              allMemos={allMemosQuery() || []}
              memosCollection={collection}
            />
          </Suspense>
        }
        center={
          <Show when={isReady()}>
            <Suspense fallback={<div class="text-text-secondary p-4">Loading editor...</div>}>
              <Editor
                content={content()}
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
                content={deferredContent()}
                onCheckboxToggle={handleCheckboxToggle}
                containerRef={setPreviewContainer}
              />
            </Suspense>
          </Show>
        }
      />
    </div>
  );
};

const MemoPage: Component = () => {
  return (
    <main>
      <EditorCacheProvider maxSize={8}>
        <EditorProvider>
          <CurrentMemoProvider>
            <MemoPageContent />
          </CurrentMemoProvider>
        </EditorProvider>
      </EditorCacheProvider>
    </main>
  );
};

export default MemoPage;
