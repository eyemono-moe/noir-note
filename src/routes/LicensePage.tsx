import { A } from "@solidjs/router";
import { type Component, ErrorBoundary, lazy, Suspense, createResource } from "solid-js";

import { APP_HOME_PATH, LICENSE_MARKDOWN_PATH, loadLicenseMarkdown } from "../utils/licensePage";

const MarkdownRenderer = lazy(() => import("../components/Preview/MarkdownRenderer"));

const LicensePage: Component = () => {
  const [license] = createResource(() => loadLicenseMarkdown());

  return (
    <main class="bg-surface-primary text-text-primary min-h-screen">
      <div class="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
        <header class="border-border-primary flex flex-wrap items-center gap-2 border-b pb-4">
          <A
            href={APP_HOME_PATH}
            class="button focus-ring inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
          >
            <span class="i-material-symbols:arrow-back-rounded size-4 shrink-0" />
            Back to app
          </A>
          <div class="min-w-0 flex-1">
            <h1 class="text-text-primary text-lg font-semibold">Licenses</h1>
            <p class="text-text-secondary text-xs">
              Bundled dependency licenses. Use Back to app to return in installed PWA windows.
            </p>
          </div>
          <a
            href={LICENSE_MARKDOWN_PATH}
            target="_blank"
            rel="noopener noreferrer"
            class="focus-ring text-text-secondary hover:text-text-primary inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors"
          >
            Raw licenses.md
            <span class="i-material-symbols:open-in-new-rounded size-3.5 shrink-0" />
          </a>
        </header>

        <section class="border-border-primary bg-surface-secondary min-h-0 flex-1 overflow-auto rounded-xl border p-4 sm:p-6">
          <ErrorBoundary
            fallback={(error) => (
              <div class="text-text-danger text-sm" role="alert">
                {error instanceof Error ? error.message : "Failed to load licenses.md"}
              </div>
            )}
          >
            <Suspense fallback={<div class="text-text-secondary text-sm">Loading licenses…</div>}>
              <MarkdownRenderer content={license() ?? ""} />
            </Suspense>
          </ErrorBoundary>
        </section>
      </div>
    </main>
  );
};

export default LicensePage;
