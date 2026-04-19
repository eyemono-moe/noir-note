import { defineConfig, presetWind3, presetIcons } from "unocss";

export default defineConfig({
  presets: [presetWind3(), presetIcons()],
  theme: {
    colors: {
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
        control: {
          rest: "var(--color-surface-control-rest)",
          hover: "var(--color-surface-control-hover)",
          active: "var(--color-surface-control-active)",
        },
      },
      border: {
        primary: "var(--color-border-primary)",
        accent: "var(--color-border-accent)",
      },
      overlay: "var(--color-overlay)",
    },
  },
  shortcuts: {
    button:
      "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors bg-surface-control-rest not-active:hover:bg-surface-control-hover active:bg-surface-control-active border border-border-primary",
  },
});
