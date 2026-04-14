import { useLocation, useSearchParams } from "@solidjs/router";
import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  on,
  onMount,
  Switch,
  Match,
} from "solid-js";
import { debounce } from "@solid-primitives/scheduled";
import { memoActions, memoStore } from "../store/memoStore";
import { uiActions } from "../store/uiStore";
import type { ViewMode } from "../types/ui";
import { normalizePath } from "../utils/path";
import { AUTO_SAVE_DELAY } from "../utils/constants";
import Editor from "../components/Editor/Editor";
import MarkdownPreview from "../components/Preview/MarkdownPreview";
import SplitView from "../components/Layout/SplitView";
import { useStorage } from "../context/storage";

const MemoPage: Component = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const storage = useStorage();

  // Get current path from URL (everything after domain)
  const currentPath = createMemo(() => normalizePath(location.pathname));

  // Get view mode and sidebar visibility from URL params
  const mode = createMemo(() => (searchParams.mode as ViewMode) || "edit");
  const showSidebar = createMemo(() => searchParams.sidebar === "tree");

  // Local content state
  const [content, setContent] = createSignal("");
  const [isLoading, setIsLoading] = createSignal(true);

  // Update UI store when URL params change
  createEffect(() => {
    uiActions.setMode(mode());
    uiActions.setSidebarVisibility(showSidebar());
  });

  // Load memo when path changes (only react to path changes, not store updates)
  createEffect(
    on(currentPath, async (path) => {
      setIsLoading(true);

      // Load directly from storage to avoid reacting to store updates
      const memo = await storage.get(path);
      if (memo) {
        setContent(memo.content);
      } else {
        // New memo - start with empty content
        setContent("");
      }

      setIsLoading(false);
    }),
  );

  // Debounced save function
  const debouncedSave = debounce((path: string, newContent: string) => {
    void memoActions.save(path, newContent, storage);
  }, AUTO_SAVE_DELAY);

  // Handle content changes
  const handleContentChange = (newContent: string) => {
    setContent(newContent);

    // Auto-save
    debouncedSave(currentPath(), newContent);
  };

  // Load all memos on mount
  onMount(() => {
    void memoActions.loadAll(storage);
  });

  return (
    <div class="h-screen w-screen flex flex-col bg-white text-black">
      <div class="flex-1 overflow-hidden">
        <Switch fallback={<div class="p-4 text-gray-500">Loading...</div>}>
          <Match when={!isLoading() && mode() === "preview"}>
            <MarkdownPreview content={content()} />
          </Match>
          <Match when={!isLoading() && mode() === "split"}>
            <SplitView
              left={
                <Editor
                  content={content()}
                  onChange={handleContentChange}
                  placeholder="Start typing..."
                />
              }
              right={<MarkdownPreview content={content()} />}
            />
          </Match>
          <Match when={!isLoading()}>
            <Editor
              content={content()}
              onChange={handleContentChange}
              placeholder="Start typing..."
            />
          </Match>
        </Switch>
      </div>

      {/* Debug info (temporary) */}
      <div class="p-2 text-xs text-gray-500 border-t border-gray-200">
        Path: {currentPath()} | Mode: {mode()} | Sidebar: {showSidebar() ? "visible" : "hidden"} |
        Memos: {memoStore.memos.size}
      </div>
    </div>
  );
};

export default MemoPage;
