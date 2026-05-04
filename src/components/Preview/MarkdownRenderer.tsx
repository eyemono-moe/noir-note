import { Carousel, Dialog } from "@ark-ui/solid";
import { ReactiveSet } from "@solid-primitives/set";
import type { Root } from "mdast";
import type { Component } from "solid-js";
import {
  For,
  Match,
  Show,
  Suspense,
  Switch,
  createEffect,
  createMemo,
  createRenderEffect,
  createResource,
  createSignal,
  onCleanup,
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";

import "../../styles/markdown.css";
import "../../styles/shiki.css";
import { useTheme } from "../../context/theme";
import type { PreviewScrollAdapter } from "../../types/scrollSync";
import {
  collectAnchors,
  getEditorLineForPreviewScrollTop,
  getPreviewScrollTopForLine,
} from "../../utils/scrollSync";
import { collectDefinitions, collectLightboxItems, extractFootnotes } from "./astUtils";
import {
  CheckboxToggleContext,
  DefinitionsContext,
  LightboxContext,
  type MermaidRegistry,
  MermaidRegistryContext,
} from "./contexts";
import { FootNotesSection, NodesRenderer, createResolvedImageSrc } from "./NodesRenderer";
import { processor } from "./processor";
import { type KeyedEntry, withStableRootKeys } from "./reconcile";

// ============================================================================
// MarkdownRenderer props
// ============================================================================

interface MarkdownRendererProps {
  content: string;
  /** Called when a task list checkbox is clicked. offset is the document character
   *  offset of the list item's start (node.position.start.offset). */
  onCheckboxToggle?: (offset: number, checked: boolean) => void;
  /** Called with the scroll adapter once the container is mounted (null on unmount). */
  onAdapterReady?: (adapter: PreviewScrollAdapter | null) => void;
}

// ============================================================================
// Lightbox visual components
// ============================================================================

/**
 * Full-size image rendered inside the lightbox dialog.
 */
const LightboxImage: Component<{ url: string }> = (props) => {
  const src = createResolvedImageSrc(() => props.url);

  return (
    <Show
      when={src()}
      fallback={
        <div class="flex size-32 items-center justify-center">
          <span class="i-material-symbols:hourglass-empty text-text-secondary size-8 shrink-0 animate-spin" />
        </div>
      }
    >
      {(s) => (
        <img
          src={s()}
          alt=""
          class="max-h-full max-w-full rounded shadow-2xl [background:conic-gradient(#eee_90deg,transparent_90deg_180deg,#eee_180deg_270deg,transparent_270deg)_50%_50%/50px_50px,#fff]"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        />
      )}
    </Show>
  );
};

/**
 * Full-size Mermaid diagram rendered inside the lightbox dialog.
 * Re-renders the SVG with the current theme at a larger size.
 */
const LightboxMermaid: Component<{ code: string }> = (props) => {
  const isDark = useTheme();

  const [result] = createResource(
    () => ({ code: props.code, dark: isDark() }),
    async (params) => {
      try {
        const { default: mermaid } = await import("mermaid");
        const id = `mermaid-lb-${Math.random().toString(36).substring(2, 11)}`;
        mermaid.initialize({
          startOnLoad: false,
          theme: params.dark ? "dark" : "default",
          suppressErrorRendering: true,
        });
        const { svg } = await mermaid.render(id, params.code);

        // Extract max-width from the SVG's inline style (e.g. style="max-width: 629.78px;")
        // so the container hugs the SVG — clicks beside the diagram reach Dialog.Content.
        const maxWidthMatch = /max-width:\s*([\d.]+px)/.exec(svg);

        return {
          success: true as const,
          svg,
          maxWidth: maxWidthMatch ? maxWidthMatch[1] : undefined,
        };
      } catch (error) {
        console.error("Mermaid rendering failed:", error);
        return { success: false as const };
      }
    },
  );

  return (
    <Suspense>
      <Show
        when={result.latest?.success}
        fallback={
          <div class="flex size-32 items-center justify-center">
            <span class="i-material-symbols:hourglass-empty text-text-secondary size-8 shrink-0 animate-spin" />
          </div>
        }
      >
        <div
          role="img"
          aria-label="Mermaid diagram"
          class="children-[svg]:mx-auto children-[svg]:block children-[svg]:max-h-full children-[svg]:h-auto bg-surface-secondary max-h-full w-full min-w-0 rounded-lg"
          style={{ "max-width": result.latest?.maxWidth ?? "100%" }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          // oxlint-disable-next-line solid/no-innerhtml
          innerHTML={result.latest?.svg}
        />
      </Show>
    </Suspense>
  );
};

// ============================================================================
// MarkdownRenderer — top-level component
// ============================================================================

const MarkdownRenderer: Component<MarkdownRendererProps> = (props) => {
  const [carouselContainerRef, setCarouselContainerRef] = createSignal<HTMLDivElement | null>(null);

  // ── Scroll adapter ──────────────────────────────────────────────────────────

  const [containerEl, setContainerEl] = createSignal<HTMLElement | undefined>();

  // Anchor cache — rebuilt lazily after content/layout changes.
  let anchorCache: ReturnType<typeof collectAnchors> | null = null;
  const invalidateAnchors = () => {
    anchorCache = null;
  };
  const getAnchors = () => {
    const el = containerEl();
    if (!el) return [];
    return (anchorCache ??= collectAnchors(el));
  };

  // Stable adapter object — closures always read live signal/cache values.
  const adapter: PreviewScrollAdapter = {
    syncFromEditorLine(line) {
      const el = containerEl();
      if (!el) return;
      const anchors = getAnchors();
      if (anchors.length === 0) return;
      const target = getPreviewScrollTopForLine(anchors, line);
      if (Math.abs(el.scrollTop - target) < 1) return;
      el.scrollTop = target;
    },
    getTopSourceLine() {
      const el = containerEl();
      if (!el) return 1;
      const anchors = getAnchors();
      if (anchors.length === 0) return 1;
      return getEditorLineForPreviewScrollTop(anchors, el.scrollTop);
    },
    subscribeScroll(handler) {
      const el = containerEl();
      if (!el) return () => {};
      el.addEventListener("scroll", handler, { passive: true });
      return () => el.removeEventListener("scroll", handler);
    },
  };

  // Set up MutationObserver + ResizeObserver for anchor cache invalidation.
  createEffect(() => {
    const el = containerEl();
    if (!el) return;

    const mo = new MutationObserver(invalidateAnchors);
    mo.observe(el, { childList: true, subtree: true });

    const ro = new ResizeObserver(invalidateAnchors);
    ro.observe(el);

    onCleanup(() => {
      mo.disconnect();
      ro.disconnect();
      anchorCache = null;
    });
  });

  // Notify parent when container (and therefore adapter) becomes ready.
  createEffect(() => {
    if (containerEl()) {
      props.onAdapterReady?.(adapter);
      onCleanup(() => props.onAdapterReady?.(null));
    }
  });

  // Parse markdown AST asynchronously
  const [parseResult] = createResource(
    () => props.content,
    async (content) => {
      try {
        const tree = processor.parse(content);
        return await processor.run(tree);
      } catch (error) {
        console.error("Failed to parse markdown:", error);
        return null;
      }
    },
  );

  // Stable store for the AST. Updated via reconcile so that For loops can track
  // node identity by reference: unchanged nodes keep the same proxy object,
  // preventing SyntaxHighlightedCode / MermaidDiagram from unmounting and losing
  // their createResource state (which would trigger the fallback flash).
  const [ast, setAst] = createStore<Root>({ type: "root", children: [] });

  // Mutable ref (not reactive) that tracks the KeyedEntry for each root child
  // from the previous render. Used by withStableRootKeys to reuse keys across
  // parses so that inserting/deleting a node above a code block does not cause
  // that code block to unmount.
  let prevKeyedChildren: KeyedEntry[] = [];

  // createRenderEffect runs before the DOM commit, ensuring the store is updated
  // before Show/NodesRenderer re-evaluate in the same reactive flush.
  createRenderEffect(() => {
    const newAst = parseResult.latest;
    if (newAst) {
      const { root: keyed, newKeyed } = withStableRootKeys(newAst as Root, prevKeyedChildren);
      prevKeyedChildren = newKeyed;
      setAst(reconcile(keyed, { key: "_$$rckey" }));
    }
  });

  const footnotes = createMemo(() => extractFootnotes(ast.children));
  const checkboxToggle = createMemo(() => props.onCheckboxToggle);
  const definitions = createMemo(() => collectDefinitions(ast.children));

  // ── Lightbox ──────────────────────────────────────────────────────────────

  // Track which mermaid offsets have successfully rendered.
  // Only those are included in the carousel.
  const mermaidSuccessOffsets = new ReactiveSet<number>();
  const mermaidRegistry: MermaidRegistry = {
    register: (offset) => mermaidSuccessOffsets.add(offset),
    unregister: (offset) => mermaidSuccessOffsets.delete(offset),
  };

  // All lightbox items in document order. Mermaid items are included only after
  // successful render; images are always included.
  const lightboxItems = createMemo(() =>
    collectLightboxItems(ast.children, definitions()).filter(
      (item) => item.type === "image" || mermaidSuccessOffsets.has(item.offset),
    ),
  );

  // null = dialog closed; number = index of the currently displayed item.
  const [lightboxIndex, setLightboxIndex] = createSignal<number | null>(null);

  const openLightbox = (offset: number) => {
    const index = lightboxItems().findIndex((i) => i.offset === offset);
    if (index !== -1) setLightboxIndex(index);
  };

  return (
    <>
      <MermaidRegistryContext.Provider value={mermaidRegistry}>
        <LightboxContext.Provider value={openLightbox}>
          <CheckboxToggleContext.Provider value={checkboxToggle}>
            <DefinitionsContext.Provider value={definitions}>
              <div
                ref={(el) => setContainerEl(el)}
                class="markdown-body h-full w-full overflow-auto p-4"
              >
                <Show when={parseResult.latest} fallback={<p>Error parsing markdown</p>}>
                  <>
                    <NodesRenderer nodes={ast.children} />
                    <Show when={footnotes().length > 0}>
                      <FootNotesSection footnotes={footnotes()} />
                    </Show>
                  </>
                </Show>
              </div>
            </DefinitionsContext.Provider>
          </CheckboxToggleContext.Provider>
        </LightboxContext.Provider>

        {/* ── Lightbox Dialog ─────────────────────────────────────────────── */}
        <Dialog.Root
          open={lightboxIndex() !== null}
          onOpenChange={(details) => {
            if (!details.open) setLightboxIndex(null);
          }}
          lazyMount
          unmountOnExit
          initialFocusEl={carouselContainerRef}
        >
          <Dialog.Backdrop class="bg-overlay fixed inset-0 z-50" />
          {/*
          Positioner covers the entire viewport. Content fills it so that the
          close button can be absolutely anchored to the top-right corner
          independent of image size.
        */}
          <Dialog.Positioner class="fixed inset-0 z-50">
            <Dialog.Content
              class="size-screen relative flex flex-col items-center justify-center gap-3 p-8 outline-none"
              onClick={() => setLightboxIndex(null)}
            >
              {/* Close — always top-right regardless of image size */}
              <Dialog.CloseTrigger class="focus-ring hover:bg-surface-transparent-hover text-text-secondary absolute top-4 right-4 inline-flex appearance-none rounded-full bg-transparent p-1.5 transition-colors">
                <span class="i-material-symbols:close-rounded size-5" />
              </Dialog.CloseTrigger>

              {/* Carousel — one slide per image */}
              <Carousel.Root
                slideCount={lightboxItems().length}
                loop
                page={lightboxIndex() ?? 0}
                onPageChange={(d) => setLightboxIndex(d.page)}
                class="flex w-full flex-col items-center gap-3 overflow-hidden"
              >
                <Carousel.ItemGroup
                  class="flex-1 overflow-hidden rounded outline-none"
                  ref={setCarouselContainerRef}
                >
                  <For each={lightboxItems()}>
                    {(item, i) => (
                      <Carousel.Item
                        index={i()}
                        class="flex items-center justify-center overflow-hidden"
                      >
                        <Switch>
                          <Match when={item.type === "image"}>
                            <LightboxImage url={(item as { url: string }).url} />
                          </Match>
                          <Match when={item.type === "mermaid"}>
                            <LightboxMermaid code={(item as { code: string }).code} />
                          </Match>
                        </Switch>
                      </Carousel.Item>
                    )}
                  </For>
                </Carousel.ItemGroup>

                <Show when={lightboxItems().length > 1}>
                  <Carousel.Control
                    class="flex shrink-0 items-center justify-center gap-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Carousel.PrevTrigger
                      title="Previous image (←)"
                      class="focus-ring hover:bg-surface-transparent-hover text-text-secondary inline-flex appearance-none rounded-full bg-transparent p-1.5 transition-colors"
                    >
                      <span class="i-material-symbols:chevron-left-rounded size-5" />
                    </Carousel.PrevTrigger>
                    <Carousel.ProgressText class="text-text-secondary min-w-12 text-center text-sm tabular-nums select-none" />
                    <Carousel.NextTrigger
                      title="Next image (→)"
                      class="focus-ring hover:bg-surface-transparent-hover text-text-secondary inline-flex appearance-none rounded-full bg-transparent p-1.5 transition-colors"
                    >
                      <span class="i-material-symbols:chevron-right-rounded size-5" />
                    </Carousel.NextTrigger>
                  </Carousel.Control>
                </Show>
              </Carousel.Root>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Root>
      </MermaidRegistryContext.Provider>
    </>
  );
};

export default MarkdownRenderer;
