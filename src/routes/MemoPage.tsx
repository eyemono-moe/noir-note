import { useLocation, useNavigate } from "@solidjs/router";
import { useLiveQuery } from "@tanstack/solid-db";
import { type Component, createMemo, lazy, Show, Suspense } from "solid-js";

import SplitView from "../components/Layout/SplitView";
import { CurrentMemoProvider, useCurrentMemo } from "../context/currentMemo";
import { useMemosCollection } from "../context/db";
import { EditorProvider, useEditorContext } from "../context/editor";
import { useEditorSplit } from "../context/editorSplit";
import { useCheckboxSync } from "../hooks/useCheckboxSync";
import { useMemoSaver } from "../hooks/useMemoOperations";
import { useScrollSync } from "../hooks/useScrollSync";
import { useScrollSyncEnabled } from "../store/configStore";
import { normalizePath } from "../utils/path";

const Editor = lazy(() => import("../components/Editor/Editor"));
const MarkdownRenderer = lazy(() => import("../components/Preview/MarkdownRenderer"));
const Sidebar = lazy(() => import("../components/Sidebar/Sidebar"));

const MemoPageContent: Component = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const editorSplitter = useEditorSplit();
  const collection = useMemosCollection();
  const currentPath = createMemo(() => normalizePath(location.pathname));

  const { content, setContent, isReady } = useCurrentMemo();
  const { editorView, setEditorView, previewContainer, setPreviewContainer } = useEditorContext();

  const { save: debouncedSave } = useMemoSaver();

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
                content={content()}
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
      <EditorProvider>
        <CurrentMemoProvider>
          <MemoPageContent />
        </CurrentMemoProvider>
      </EditorProvider>
    </main>
  );
};

export default MemoPage;
