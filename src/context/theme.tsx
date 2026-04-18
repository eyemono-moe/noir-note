import { usePrefersDark } from "@solid-primitives/media";
import {
  createContext,
  createEffect,
  createMemo,
  useContext,
  type Accessor,
  type ParentComponent,
} from "solid-js";

import { useConfig } from "../store/configStore";

type ThemeContextValue = Accessor<boolean>;

const ThemeContext = createContext<ThemeContextValue>();

export const ThemeProvider: ParentComponent = (props) => {
  const [config] = useConfig();
  const prefersDark = usePrefersDark();

  // Resolve effective theme based on config and system preference
  const isDark = createMemo(() => {
    const theme = config().theme;
    if (theme === "system") {
      return prefersDark();
    }
    return theme === "dark";
  });

  // Apply theme to document
  createEffect(() => {
    const root = document.documentElement;
    if (isDark()) {
      root.setAttribute("data-theme", "dark");
      root.style.colorScheme = "dark";
    } else {
      root.setAttribute("data-theme", "light");
      root.style.colorScheme = "light";
    }
  });

  return <ThemeContext.Provider value={isDark}>{props.children}</ThemeContext.Provider>;
};

export function useTheme(): Accessor<boolean> {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
