import { Dialog } from "@ark-ui/solid/dialog";
import { RadioGroup } from "@ark-ui/solid/radio-group";
import { Switch } from "@ark-ui/solid/switch";
import { type Component, createSignal, For, lazy, Show, Suspense } from "solid-js";
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
    <Dialog.Positioner class="pointer-events-auto fixed inset-x-0 top-1/2 z-50 flex max-h-screen -translate-y-1/2 items-start justify-center p-4">
      <Dialog.Content
        class="border-border-primary bg-surface-primary grid max-h-screen w-[48rem] max-w-[95vw] grid-rows-[auto_1fr] overflow-hidden rounded-xl border shadow-xl"
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
        <Suspense
          fallback={
            <div class="text-text-secondary flex h-40 items-center justify-center text-sm">
              Loading…
            </div>
          }
        >
          <MarkdownRenderer content={privacyContent} />
        </Suspense>
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
            <RadioGroup.Root
              value={config().theme}
              onValueChange={(d) => updateTheme(d.value as ThemeMode)}
              class="flex gap-1.5"
            >
              <For each={THEME_OPTIONS}>
                {(opt) => (
                  <RadioGroup.Item value={opt.value} class="flex flex-1">
                    <RadioGroup.ItemHiddenInput />
                    <RadioGroup.ItemControl class="data-[focus-visible]:outline-border-accent border-border-primary text-text-secondary hover:bg-surface-transparent-hover hover:text-text-primary data-[state=checked]:border-text-accent data-[state=checked]:bg-surface-secondary data-[state=checked]:text-text-accent flex flex-1 cursor-pointer flex-col items-center gap-1 rounded border bg-transparent px-2 py-2 text-xs transition-colors data-[focus-visible]:outline data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2">
                      <span class={`${opt.icon} size-4 shrink-0`} />
                      <RadioGroup.ItemText>{opt.label}</RadioGroup.ItemText>
                    </RadioGroup.ItemControl>
                  </RadioGroup.Item>
                )}
              </For>
            </RadioGroup.Root>
          </section>

          {/* ── Editor ────────────────────────────────────────────────── */}
          <section class="border-border-primary border-b px-3 py-3">
            <p class="text-text-secondary mb-2 text-[0.6875rem] font-semibold tracking-[0.04em] uppercase">
              Editor
            </p>

            {/* Scroll sync toggle */}
            <Switch.Root
              checked={scrollSyncEnabled()}
              onCheckedChange={(d) => updateScrollSyncEnabled(d.checked)}
              class="flex cursor-pointer items-center justify-between gap-3 rounded px-1 py-1.5"
            >
              <Switch.Label class="text-text-primary text-xs">Scroll sync</Switch.Label>
              <Switch.Control class="b-1 b-border-primary data-[focus-visible]:outline-border-accent bg-surface-secondary data-[state=checked]:bg-text-accent relative inline-flex h-5 w-9 shrink-0 rounded-full p-[1px] transition-colors data-[focus-visible]:outline data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2">
                <Switch.Thumb class="b-border-primary b-1 pointer-events-none inline-block size-4 translate-x-0 rounded-full bg-white shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-4" />
              </Switch.Control>
              <Switch.HiddenInput />
            </Switch.Root>
          </section>
        </div>

        {/* ── Footer links ──────────────────────────────────────────────── */}
        <div class="border-border-primary flex shrink-0 flex-col gap-0.5 border-t px-3 py-2">
          <a
            href="/licenses.md"
            target="_blank"
            rel="noopener noreferrer"
            class="focus-ring text-text-secondary hover:text-text-primary flex items-center gap-1.5 rounded px-1 py-1 text-xs transition-colors"
          >
            <span class="i-material-symbols:description-outline-rounded size-3.5 shrink-0" />
            License (MIT)
          </a>
          <button
            type="button"
            class="focus-ring text-text-secondary hover:text-text-primary flex items-center gap-1.5 rounded bg-transparent px-1 py-1 text-left text-xs transition-colors"
            onClick={() => setPrivacyOpen(true)}
          >
            <span class="i-material-symbols:shield-outline-rounded size-3.5 shrink-0" />
            Privacy Policy
          </button>
          <a
            href="https://github.com/eyemono-moe/noir-note"
            target="_blank"
            rel="noopener noreferrer"
            class="focus-ring text-text-secondary hover:text-text-primary flex items-center gap-1.5 rounded px-1 py-1 text-xs transition-colors"
          >
            <span class="i-material-symbols:code-rounded size-3.5 shrink-0" />
            GitHub Repository
          </a>
          <Show when={import.meta.env.NOIR_GIT_COMMIT_HASH !== "unknown"}>
            <div class="text-text-secondary text-xs">
              builded on commit{" "}
              <a
                href={`https://github.com/eyemono-moe/noir-note/commit/${import.meta.env.NOIR_GIT_COMMIT_HASH}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {import.meta.env.NOIR_GIT_COMMIT_HASH}
              </a>
            </div>
          </Show>
        </div>
      </div>

      <Portal>
        <PrivacyDialog open={privacyOpen()} onClose={() => setPrivacyOpen(false)} />
      </Portal>
    </>
  );
};
