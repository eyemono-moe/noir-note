import { defineConfig, presetMini } from "unocss";

export default defineConfig({
  presets: [presetMini()],
  theme: {
    colors: {
      black: "#000000",
      white: "#ffffff",
      gray: {
        100: "#f5f5f5",
        200: "#e0e0e0",
        300: "#d0d0d0",
        400: "#a0a0a0",
        500: "#808080",
        600: "#606060",
        700: "#404040",
        800: "#202020",
      },
    },
  },
});
