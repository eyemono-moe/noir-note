import { debounce } from "@solid-primitives/scheduled";
import { useLocation, useNavigate } from "@solidjs/router";
import { eq, useLiveQuery } from "@tanstack/solid-db";
import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  onMount,
  Show,
  Switch,
  Match,
} from "solid-js";

import { allCommands } from "../commands/definitions";
import CommandPalette from "../commands/palette";
import { commandRegistry } from "../commands/registry";
import type { CommandContext } from "../commands/types";
import Editor from "../components/Editor/Editor";
import SplitView from "../components/Layout/SplitView";
import MarkdownPreview from "../components/Preview/MarkdownPreview";
import Sidebar from "../components/Sidebar/Sidebar";
import { useMemosCollection } from "../context/db";
import { useUIState } from "../hooks/useUIState";
import { AUTO_SAVE_DELAY } from "../utils/constants";
import { parseFrontmatter } from "../utils/frontmatter";
import { normalizePath } from "../utils/path";

const MemoPage: Component = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { mode, sidebarVisible, setMode, toggleSidebar } = useUIState();

  // Get memos collection
  const memosCollectionResource = useMemosCollection();

  // Get current path from URL
  const currentPath = createMemo(() => normalizePath(location.pathname));

  // Query for current memo using useLiveQuery
  const currentMemoQuery = useLiveQuery((q) => {
    const collection = memosCollectionResource();
    if (!collection) return null;

    const path = currentPath(); // Signal is tracked automatically
    return q
      .from({ memos: collection })
      .where(({ memos }) => eq(memos.path, path))
      .select(({ memos }) => memos);
  });

  // Local content state (for editing without saving immediately)
  const [localContent, setLocalContent] = createSignal("");
  const [isSaving, setIsSaving] = createSignal(false);

  // Sync currentMemo to localContent when it changes
  createEffect(() => {
    const memos = currentMemoQuery();
    const memo = memos?.[0]; // useLiveQuery returns array
    if (memo) {
      setLocalContent(memo.content);
    } else if (currentMemoQuery.isReady) {
      setLocalContent("");
    }
  });

  // Debounced save function with optimistic update
  const debouncedSave = debounce(async (path: string, newContent: string) => {
    const collection = memosCollectionResource();
    if (!collection) {
      console.error("[MemoPage] Cannot save: collection not ready");
      return;
    }

    console.log("[MemoPage] Saving memo:", { path, contentLength: newContent.length });
    setIsSaving(true);

    try {
      const now = Date.now();
      const memos = currentMemoQuery();
      const existing = memos?.[0];

      // Parse frontmatter from content
      const { metadata } = parseFrontmatter(newContent);

      if (existing) {
        // Update existing memo using draft function
        collection.update(path, (draft) => {
          draft.content = newContent;
          draft.updatedAt = now;
          draft.metadata = metadata;
        });
        console.log("[MemoPage] Memo updated successfully", { hasMetadata: !!metadata });
      } else {
        // Insert new memo
        collection.insert({
          path,
          content: newContent,
          createdAt: now,
          updatedAt: now,
          metadata,
        });
        console.log("[MemoPage] New memo created successfully", { hasMetadata: !!metadata });
      }
    } catch (error) {
      console.error("[MemoPage] Save failed:", error);
    } finally {
      setIsSaving(false);
    }
  }, AUTO_SAVE_DELAY);

  // Handle content changes
  const handleContentChange = (newContent: string) => {
    setLocalContent(newContent);
    debouncedSave(currentPath(), newContent);
  };

  // Register commands on mount
  onMount(() => {
    for (const command of allCommands) {
      commandRegistry.register(command);
    }
  });

  // Create command context
  const commandContext = createMemo<CommandContext>(() => ({
    currentPath: currentPath(),
    currentMode: mode(),
    sidebarVisible: sidebarVisible(),
    navigate: (path: string) => navigate(path),
    setMode,
    toggleSidebar,
  }));

  // All memos query for sidebar and command palette
  const allMemosQuery = useLiveQuery((q) => {
    const collection = memosCollectionResource();
    if (!collection) return null;
    return q.from({ memos: collection });
  });

  return (
    <>
      <Show
        when={memosCollectionResource() && allMemosQuery.isReady}
        fallback={
          <div class="flex h-screen w-screen items-center justify-center">
            <div class="text-text-secondary text-lg">Initializing database...</div>
          </div>
        }
      >
        <CommandPalette
          context={commandContext()}
          allMemos={allMemosQuery() || []}
          collection={memosCollectionResource()!}
        />
        <div class="bg-surface-primary text-text-primary flex h-screen w-screen overflow-hidden">
          <Sidebar
            currentPath={currentPath()}
            onNavigate={(path) => navigate(path)}
            onDelete={(path) => {
              console.log("[MemoPage] Deleting memo:", path);
              const collection = memosCollectionResource();
              if (collection) {
                collection.delete(path); // Optimistic delete
              }
            }}
            visible={sidebarVisible()}
            allMemos={allMemosQuery() || []}
            memosCollection={memosCollectionResource()!}
          />
          <div class="flex flex-1 flex-col overflow-hidden">
            <Switch>
              <Match when={currentMemoQuery.isReady && mode() === "preview"}>
                <MarkdownPreview content={localContent()} />
              </Match>
              <Match when={currentMemoQuery.isReady && mode() === "split"}>
                <SplitView
                  left={
                    <Editor
                      content={localContent()}
                      onChange={handleContentChange}
                      placeholder="Start typing..."
                    />
                  }
                  right={<MarkdownPreview content={localContent()} />}
                />
              </Match>
              <Match when={currentMemoQuery.isReady}>
                <Editor
                  content={localContent()}
                  onChange={handleContentChange}
                  placeholder="Start typing..."
                />
              </Match>
            </Switch>

            {/* Debug info */}
            <div class="border-border-primary text-text-secondary border-t p-2 text-xs">
              Path: {currentPath()} | Mode: {mode()} | Sidebar:{" "}
              {sidebarVisible() ? "visible" : "hidden"} | Memos: {allMemosQuery()?.length ?? 0}
              {isSaving() && " | Saving..."}
            </div>
          </div>
        </div>
      </Show>
    </>
  );
};

export default MemoPage;
