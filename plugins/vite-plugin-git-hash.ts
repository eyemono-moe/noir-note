import { execSync } from "node:child_process";

/**
 * Vite plugin that injects the current git commit hash as a global constant
 * `__GIT_COMMIT_HASH__` at build time.
 */
export function gitHashPlugin() {
  const hash = (() => {
    try {
      return execSync("git rev-parse --short HEAD").toString().trim();
    } catch {
      return "unknown";
    }
  })();

  return {
    name: "vite-plugin-git-hash",
    config() {
      return {
        define: {
          "import.meta.env.NOIR_GIT_COMMIT_HASH": JSON.stringify(hash),
        },
      };
    },
  };
}
