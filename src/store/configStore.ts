import { makePersisted } from "@solid-primitives/storage";
import { createSignal } from "solid-js";

type ThemeMode = "light" | "dark" | "system";

interface AppConfig {
  theme: ThemeMode;
  splitterSizes?: number[];
  scrollSyncEnabled?: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
  theme: "system",
  scrollSyncEnabled: true,
};

// Create reactive config store with localStorage persistence
// oxlint-disable-next-line solid/reactivity
const [config, setConfig] = makePersisted(createSignal<AppConfig>(DEFAULT_CONFIG), {
  name: "app-config",
});

export function useConfig() {
  return [config, setConfig] as const;
}

export function updateTheme(theme: ThemeMode) {
  setConfig((prev) => ({ ...prev, theme }));
}

export function updateSplitterSizes(sizes: number[]) {
  setConfig((prev) => ({ ...prev, splitterSizes: sizes }));
}

export function updateScrollSyncEnabled(enabled: boolean) {
  setConfig((prev) => ({ ...prev, scrollSyncEnabled: enabled }));
}

export function useScrollSyncEnabled() {
  return () => config().scrollSyncEnabled ?? true;
}
