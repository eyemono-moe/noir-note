import { createSignal } from "solid-js";

import type { ViewMode } from "../types/ui";

const [viewMode, setViewMode] = createSignal<ViewMode>("edit");
const [sidebarVisible, setSidebarVisible] = createSignal(false);

export { viewMode, setViewMode, sidebarVisible, setSidebarVisible };

export const uiActions = {
  setMode(mode: ViewMode) {
    setViewMode(mode);
  },

  toggleSidebar() {
    setSidebarVisible((prev) => !prev);
  },

  setSidebarVisibility(visible: boolean) {
    setSidebarVisible(visible);
  },
};
