import { defineConfig, presetWind3, presetIcons } from "unocss";

export default defineConfig({
  presets: [presetWind3(), presetIcons()],
  theme: {
    colors: {
      // Semantic colors (CSS variables)
      // Pattern: element.role
      text: {
        primary: "var(--color-text-primary)",
        secondary: "var(--color-text-secondary)",
        disabled: "var(--color-text-disabled)",
        accent: "var(--color-text-accent)",
        danger: "var(--color-text-danger)",
      },

      surface: {
        primary: "var(--color-surface-primary)",
        secondary: "var(--color-surface-secondary)",
        accent: "var(--color-surface-accent)",
        transparent: {
          hover: "var(--color-surface-transparent-hover)",
          active: "var(--color-surface-transparent-active)",
          accent: "var(--color-surface-transparent-accent)",
        },
      },
      border: {
        primary: "var(--color-border-primary)",
        accent: "var(--color-border-accent)",
      },
      overlay: "var(--color-overlay)",
    },
  },
});
