import { createEffect, createSignal } from "solid-js";

import type { ViewMode } from "../types/ui";

const STORAGE_PREFIX = "noir:";

export const useUIState = () => {
  // LocalStorage: persist all UI state
  const [mode, setMode] = createSignal<ViewMode>(
    (localStorage.getItem(`${STORAGE_PREFIX}viewMode`) as ViewMode) || "edit",
  );
  const [sidebarVisible, setSidebarVisible] = createSignal<boolean>(
    localStorage.getItem(`${STORAGE_PREFIX}sidebar`) === "true",
  );

  // Save to localStorage when state changes
  createEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}viewMode`, mode());
  });

  createEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}sidebar`, String(sidebarVisible()));
  });

  const toggleMode = () => {
    setMode((prev: ViewMode) => {
      if (prev === "edit") return "preview";
      if (prev === "preview") return "split";
      return "edit";
    });
  };

  const toggleSidebar = () => {
    setSidebarVisible((prev: boolean) => !prev);
  };

  return {
    mode,
    sidebarVisible,
    setMode,
    toggleMode,
    toggleSidebar,
  };
};
