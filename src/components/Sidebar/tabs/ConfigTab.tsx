import { Dialog } from "@ark-ui/solid/dialog";
import { type Component, createSignal, For, lazy, Suspense } from "solid-js";
import { Portal } from "solid-js/web";

// Import privacy policy markdown as a raw string at build time.
// The file lives at the repo root so its change history is tracked in git.
// oxlint-disable-next-line import/no-unresolved
import privacyContent from "../../../../PRIVACY.md?raw";
import {
  updateScrollSyncEnabled,
  updateTheme,
  useConfig,
  useScrollSyncEnabled,
} from "../../../store/configStore";

const MarkdownRenderer = lazy(() => import("../../Preview/MarkdownRenderer"));

const GITHUB_PRIVACY_HISTORY_URL =
  "https://github.com/eyemono-moe/noir-note/commits/main/PRIVACY.md";

// ---------------------------------------------------------------------------
// Theme options
// ---------------------------------------------------------------------------

type ThemeMode = "light" | "dark" | "system";

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "i-material-symbols:light-mode-outline-rounded" },
  { value: "dark", label: "Dark", icon: "i-material-symbols:dark-mode-outline-rounded" },
  { value: "system", label: "System", icon: "i-material-symbols:devices-rounded" },
];

// ---------------------------------------------------------------------------
// PrivacyDialog
// ---------------------------------------------------------------------------

const PrivacyDialog: Component<{ open: boolean; onClose: () => void }> = (props) => (
  <Dialog.Root
    open={props.open}
    onOpenChange={(d) => {
      if (!d.open) props.onClose();
    }}
    lazyMount
    unmountOnExit
  >
    <Dialog.Backdrop class="bg-overlay fixed inset-0 z-50" />
    <Dialog.Positioner class="pointer-events-auto fixed inset-x-0 top-1/2 z-50 flex max-h-[90dvh] -translate-y-1/2 items-start justify-center p-4">
      <Dialog.Content
        class="border-border-primary bg-surface-primary flex w-[48rem] max-w-[95vw] flex-col overflow-hidden rounded-xl border shadow-xl"
        style={{ "max-height": "calc(90dvh - 2rem)" }}
      >
        {/* Header */}
        <div class="border-border-primary flex shrink-0 items-center gap-2 border-b px-4 py-3">
          <Dialog.Title class="text-text-primary flex-1 text-sm font-semibold">
            Privacy Policy
          </Dialog.Title>
          <a
            href={GITHUB_PRIVACY_HISTORY_URL}
            target="_blank"
            rel="noopener noreferrer"
            class="focus-ring text-text-secondary hover:text-text-primary flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors"
            title="View change history on GitHub"
          >
            <span class="i-material-symbols:history-rounded size-3.5 shrink-0" />
            View change history on GitHub
          </a>
          <Dialog.CloseTrigger class="focus-ring hover:bg-surface-transparent-hover text-text-secondary inline-flex appearance-none rounded bg-transparent p-1 transition-colors">
            <span class="i-material-symbols:close-rounded size-4" />
          </Dialog.CloseTrigger>
        </div>

        {/* Markdown content
            The outer div is the flex child that claims the remaining height and scrolls.
            containerRef overrides MarkdownRenderer's built-in `h-full overflow-auto` so
            content flows to its natural height and the wrapper handles scrolling instead. */}
        <div class="min-h-0 flex-1 overflow-y-auto">
          <Suspense
            fallback={
              <div class="text-text-secondary flex h-40 items-center justify-center text-sm">
                Loading…
              </div>
            }
          >
            <MarkdownRenderer
              content={privacyContent}
              containerRef={(el) => {
                el.style.height = "auto";
                el.style.overflow = "visible";
              }}
            />
          </Suspense>
        </div>
      </Dialog.Content>
    </Dialog.Positioner>
  </Dialog.Root>
);

// ---------------------------------------------------------------------------
// ConfigTab
// ---------------------------------------------------------------------------

export const ConfigTab: Component = () => {
  const [config] = useConfig();
  const scrollSyncEnabled = useScrollSyncEnabled();
  const [privacyOpen, setPrivacyOpen] = createSignal(false);

  return (
    <>
      <div class="flex h-full flex-col overflow-hidden">
        {/* Section header */}
        <div class="flex shrink-0 items-center px-3 py-1.5">
          <span class="text-text-secondary flex-1 text-[0.6875rem] font-bold tracking-[0.06em] uppercase">
            Settings
          </span>
        </div>

        {/* Scrollable settings body */}
        <div class="min-h-0 flex-1 overflow-y-auto">
          {/* ── Theme ─────────────────────────────────────────────────── */}
          <section class="border-border-primary border-b px-3 py-3">
            <p class="text-text-secondary mb-2 text-[0.6875rem] font-semibold tracking-[0.04em] uppercase">
              Theme
            </p>
            <div class="flex gap-1.5">
              <For each={THEME_OPTIONS}>
                {(opt) => (
                  <button
                    type="button"
                    title={opt.label}
                    class={`focus-ring flex flex-1 flex-col items-center gap-1 rounded border px-2 py-2 text-xs transition-colors ${
                      config().theme === opt.value
                        ? "border-text-accent bg-surface-secondary text-text-accent"
                        : "border-border-primary text-text-secondary hover:bg-surface-transparent-hover hover:text-text-primary"
                    }`}
                    onClick={() => updateTheme(opt.value)}
                  >
                    <span class={`${opt.icon} size-4 shrink-0`} />
                    <span>{opt.label}</span>
                  </button>
                )}
              </For>
            </div>
          </section>

          {/* ── Editor ────────────────────────────────────────────────── */}
          <section class="border-border-primary border-b px-3 py-3">
            <p class="text-text-secondary mb-2 text-[0.6875rem] font-semibold tracking-[0.04em] uppercase">
              Editor
            </p>

            {/* Scroll sync toggle */}
            <div class="flex items-center justify-between gap-3 rounded px-1 py-1.5">
              <span class="text-text-primary text-xs" id="scroll-sync-label">
                Scroll sync
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={scrollSyncEnabled()}
                aria-labelledby="scroll-sync-label"
                class={`focus-ring relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  scrollSyncEnabled() ? "bg-text-accent" : "bg-surface-secondary"
                }`}
                onClick={() => updateScrollSyncEnabled(!scrollSyncEnabled())}
              >
                <span
                  class={`pointer-events-none inline-block size-4 rounded-full bg-white shadow-sm ring-0 transition-transform ${
                    scrollSyncEnabled() ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </section>
        </div>

        {/* ── Footer links ──────────────────────────────────────────────── */}
        <div class="border-border-primary shrink-0 border-t px-3 py-2">
          <div class="flex flex-col gap-0.5">
            <a
              href="/LICENSE.md"
              target="_blank"
              rel="noopener noreferrer"
              class="focus-ring text-text-secondary hover:text-text-primary flex items-center gap-1.5 rounded px-1 py-1 text-xs transition-colors"
            >
              <span class="i-material-symbols:description-outline-rounded size-3.5 shrink-0" />
              License (MIT)
            </a>
            <a
              href="https://github.com/eyemono-moe/noir-note"
              target="_blank"
              rel="noopener noreferrer"
              class="focus-ring text-text-secondary hover:text-text-primary flex items-center gap-1.5 rounded px-1 py-1 text-xs transition-colors"
            >
              <span class="i-material-symbols:code-rounded size-3.5 shrink-0" />
              GitHub Repository
            </a>
            <button
              type="button"
              class="focus-ring text-text-secondary hover:text-text-primary flex items-center gap-1.5 rounded bg-transparent px-1 py-1 text-left text-xs transition-colors"
              onClick={() => setPrivacyOpen(true)}
            >
              <span class="i-material-symbols:shield-outline-rounded size-3.5 shrink-0" />
              Privacy Policy
            </button>
          </div>
        </div>
      </div>

      <Portal>
        <PrivacyDialog open={privacyOpen()} onClose={() => setPrivacyOpen(false)} />
      </Portal>
    </>
  );
};
