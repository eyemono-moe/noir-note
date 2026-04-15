import { debounce } from "@solid-primitives/scheduled";
import { useLocation, useNavigate } from "@solidjs/router";
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

import { allCommands } from "../commands/definitions";
import CommandPalette from "../commands/palette";
import { commandRegistry } from "../commands/registry";
import type { CommandContext } from "../commands/types";
import Editor from "../components/Editor/Editor";
import SplitView from "../components/Layout/SplitView";
import MarkdownPreview from "../components/Preview/MarkdownPreview";
import Sidebar from "../components/Sidebar/Sidebar";
import { useStorage } from "../context/storage";
import { useUIState } from "../hooks/useUIState";
import { createMemoResource } from "../store/memoResource";
import { AUTO_SAVE_DELAY } from "../utils/constants";
import { normalizePath } from "../utils/path";

const MemoPage: Component = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const storage = useStorage();
  const { mode, sidebarVisible, setMode, toggleSidebar } = useUIState();

  // Create reactive memo resource
  const memoResource = createMemoResource(storage);

  // Get current path from URL (everything after domain)
  const currentPath = createMemo(() => normalizePath(location.pathname));

  // Local content state (for editing without saving immediately)
  const [localContent, setLocalContent] = createSignal("");
  const [hasLocalChanges, setHasLocalChanges] = createSignal(false);

  // Load content when path changes (navigation)
  // This effect ONLY runs when path changes, not when memo updates from storage
  createEffect(
    on(
      currentPath,
      (path) => {
        console.log("[MemoPage] Path changed, loading content:", path);
        const memo = memoResource.findMemo(path);
        if (memo) {
          console.log("[MemoPage] Found memo in list, loading content");
          setLocalContent(memo.content);
        } else {
          console.log("[MemoPage] No memo found, starting with empty content");
          setLocalContent("");
        }
        setHasLocalChanges(false);
      },
      { defer: true },
    ),
  );

  // Debounced save function
  const debouncedSave = debounce(async (path: string, newContent: string) => {
    console.log("[MemoPage] debouncedSave executing:", { path, contentLength: newContent.length });
    const success = await memoResource.saveMemo(path, newContent);
    console.log("[MemoPage] saveMemo result:", { success });
    if (success) {
      setHasLocalChanges(false);
    }
  }, AUTO_SAVE_DELAY);

  // Handle content changes
  const handleContentChange = (newContent: string) => {
    console.log("[MemoPage] handleContentChange:", { contentLength: newContent.length });
    setLocalContent(newContent);
    setHasLocalChanges(true);

    // Auto-save
    debouncedSave(currentPath(), newContent);
  };

  // Register commands on mount
  onMount(() => {
    // Register all commands
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

  return (
    <>
      <CommandPalette context={commandContext()} memoResource={memoResource} />
      <div class="flex h-screen w-screen flex-col bg-white text-black">
        <div class="flex flex-1 overflow-hidden">
          <Sidebar
            currentPath={currentPath()}
            onNavigate={(path) => navigate(path)}
            onDelete={(path) => {
              console.log("sidebar onDelete", path);
              void memoResource.deleteMemo(path);
            }}
            onInsert={(_parentPath) => {}}
            visible={sidebarVisible()}
            memoResource={memoResource}
          />
          <div class="flex flex-1 flex-col overflow-hidden">
            <Switch fallback={<div class="p-4 text-gray-500">Loading...</div>}>
              <Match when={!memoResource.memos.loading && mode() === "preview"}>
                <MarkdownPreview content={localContent()} />
              </Match>
              <Match when={!memoResource.memos.loading && mode() === "split"}>
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
              <Match when={!memoResource.memos.loading}>
                <Editor
                  content={localContent()}
                  onChange={handleContentChange}
                  placeholder="Start typing..."
                />
              </Match>
            </Switch>

            {/* Debug info (temporary) */}
            <div class="border-t border-gray-200 p-2 text-xs text-gray-500">
              Path: {currentPath()} | Mode: {mode()} | Sidebar:{" "}
              {sidebarVisible() ? "visible" : "hidden"} | Memos: {memoResource.memosArray().length}
              {hasLocalChanges() ? " | Unsaved changes" : ""}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MemoPage;
