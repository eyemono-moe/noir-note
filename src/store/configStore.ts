import { makePersisted } from "@solid-primitives/storage";
import { createSignal } from "solid-js";

export type ThemeMode = "light" | "dark" | "system";

export interface AppConfig {
  theme: ThemeMode;
}

const DEFAULT_CONFIG: AppConfig = {
  theme: "system",
};

// Create reactive config store with localStorage persistence
const [config, setConfig] = makePersisted(createSignal<AppConfig>(DEFAULT_CONFIG), {
  name: "app-config",
});

export function useConfig() {
  return [config, setConfig] as const;
}

export function updateTheme(theme: ThemeMode) {
  setConfig((prev) => ({ ...prev, theme }));
}
