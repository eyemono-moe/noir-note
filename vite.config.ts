import UnoCSS from "unocss/vite";
import { analyzer } from "vite-bundle-analyzer";
import solidPlugin from "vite-plugin-solid";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [UnoCSS(), solidPlugin(), analyzer()],
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: ["dist/**"],
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
