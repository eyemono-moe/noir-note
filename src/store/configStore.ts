import { makePersisted } from "@solid-primitives/storage";
import { createStore } from "solid-js/store";

type ThemeMode = "light" | "dark" | "system";

interface AppConfig {
  theme: ThemeMode;
  splitterSizes?: number[];
  scrollSyncEnabled?: boolean;
  sidebarAccordionState?: string[];
  sidebarTab?: string;
}

const DEFAULT_CONFIG: AppConfig = {
  theme: "system",
  scrollSyncEnabled: true,
};

/**
 * Returns window.localStorage if accessible, or undefined when the browser
 * blocks it (e.g. strict privacy settings, third-party cookie blocking).
 * Must be called synchronously at module-init time so the app never crashes
 * with a SecurityError before any component can mount.
 */
function getLocalStorageIfAvailable(): Storage | undefined {
  try {
    window.localStorage.getItem("");
    return window.localStorage;
  } catch {
    return undefined;
  }
}

const _storage = getLocalStorageIfAvailable();

// Create reactive config store with localStorage persistence.
// Falls back to a plain in-memory signal when localStorage is blocked so the
// app can still render — config just won't persist across page loads.
// oxlint-disable solid/reactivity
const [config, setConfig] = _storage
  ? makePersisted(createStore<AppConfig>(DEFAULT_CONFIG), {
      name: "app-config",
      storage: _storage,
    })
  : createStore<AppConfig>(DEFAULT_CONFIG);
// oxlint-enable solid/reactivity

export function useConfig() {
  return [config, setConfig] as const;
}

export function updateTheme(theme: ThemeMode) {
  setConfig("theme", theme);
}

export function updateSplitterSizes(sizes: number[]) {
  setConfig("splitterSizes", sizes);
}

export function updateScrollSyncEnabled(enabled: boolean) {
  setConfig("scrollSyncEnabled", enabled);
}

export function useScrollSyncEnabled() {
  return () => config.scrollSyncEnabled ?? true;
}

export function updateSidebarAccordionState(state: string[]) {
  setConfig("sidebarAccordionState", state);
}

export function useSidebarAccordionState() {
  return () => config.sidebarAccordionState ?? ["explorer"];
}

export function updateSidebarTab(tab: string) {
  setConfig("sidebarTab", tab);
}

export function useSidebarTab() {
  return () => config.sidebarTab ?? "explorer";
}
