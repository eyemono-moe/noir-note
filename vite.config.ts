import UnoCSS from "unocss/vite";
import { analyzer } from "vite-bundle-analyzer";
import { VitePWA } from "vite-plugin-pwa";
import solidPlugin from "vite-plugin-solid";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [
    UnoCSS(),
    solidPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon-180x180.png"],
      manifest: {
        name: "eyemono.md",
        short_name: "eyemono.md",
        description:
          "A markdown note-taking app that runs entirely in your browser. All notes are stored locally using IndexedDB.",
        theme_color: "#010409",
        background_color: "#010409",
        display: "standalone",
        icons: [
          {
            src: "pwa-64x64.png",
            sizes: "64x64",
            type: "image/png",
          },
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,woff}"],
        navigateFallback: "/index.html",
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
    analyzer(),
  ],
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: ["dist/**", "preview-test.md"],
    sortImports: true,
    sortTailwindcss: true,
    sortPackageJson: true,
  },
  lint: {
    ignorePatterns: ["dist/**"],
    options: { typeAware: true, typeCheck: true },
    plugins: ["eslint", "typescript", "unicorn", "oxc", "import", "jsx-a11y", "promise", "vitest"],
    jsPlugins: ["eslint-plugin-solid"],
    rules: {
      "solid/components-return-once": "warn",
      "solid/event-handlers": "warn",
      "solid/imports": "warn",
      "solid/jsx-no-duplicate-props": "error",
      "solid/jsx-no-script-url": "error",
      "solid/jsx-no-undef": "error",
      "solid/jsx-uses-vars": "error",
      "solid/no-array-handlers": "off",
      "solid/no-destructure": "error",
      "solid/no-innerhtml": "error",
      "solid/no-proxy-apis": "off",
      "solid/no-react-deps": "warn",
      "solid/no-react-specific-props": "warn",
      "solid/no-unknown-namespaces": "error",
      "solid/prefer-classlist": "off",
      "solid/prefer-for": "error",
      "solid/prefer-show": "off",
      "solid/reactivity": "warn",
      "solid/self-closing-comp": "warn",
      "solid/style-prop": "warn",
    },
  },
  optimizeDeps: {
    // Add both @codemirror/state and @codemirror/view to included deps to optimize
    include: ["@codemirror/state", "@codemirror/view"],
  },
  build: {
    license: { fileName: "LICENSE.md" },
    rolldownOptions: {
      output: {
        postBanner: "/* See licenses of bundled dependencies at `/LICENSE.md` */",
      },
    },
  },
});
