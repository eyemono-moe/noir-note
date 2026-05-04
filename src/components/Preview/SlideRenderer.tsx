import { type Component, createEffect, createResource, createSignal, onMount } from "solid-js";

import type { PreviewScrollAdapter } from "../../types/scrollSync";
import { buildMarpHtml, downloadHtml } from "../../utils/marpExport";
import { buildSlideLineRanges, slideIndexForLine, type SlideLineRange } from "./marpUtils";

// ---------------------------------------------------------------------------
// Shadow DOM styles injected alongside Marp's generated CSS.
// CSS custom properties (--color-*) are inherited from the host document
// through the shadow boundary, so our design tokens work without importing
// colors.css into the shadow root.
// ---------------------------------------------------------------------------
const SHADOW_BASE_STYLE = `
  :host {
    display: block;
    overflow: auto;
  }
  div.marpit {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    box-sizing: border-box;
    min-height: 100%;
  }
  div.marpit > svg {
    border: 1px solid var(--color-border-primary);
    display: block;
  }
`;

// ---------------------------------------------------------------------------
// Marp rendering — also computes slide line ranges in the same pass
// ---------------------------------------------------------------------------

interface MarpResult {
  html: string;
  css: string;
  /** One entry per slide, built from markdown-it `marpit_slide_open` token positions. */
  lineRanges: SlideLineRange[];
}

async function renderWithMarp(content: string): Promise<MarpResult> {
  const { Marp } = await import("@marp-team/marp-core");
  const marp = new Marp();

  // Use the same markdown-it instance that Marp will use for rendering so that
  // the tokenizer (including Marpit's frontmatter and slide-separator rules) is
  // identical to the actual render pass.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const tokens: { type: string; map: [number, number] | null }[] = marp.markdown.parse(content, {});

  const slideOpenLineIndices = tokens
    .filter((t) => t.type === "marpit_slide_open" && t.map !== null)
    .map((t) => t.map![0] + 1); // map[0] is 0-indexed → convert to 1-indexed

  const totalLines = content.split("\n").length;
  const lineRanges = buildSlideLineRanges(slideOpenLineIndices, totalLines);

  const { html, css } = marp.render(content);

  return { html, css, lineRanges };
}

// ---------------------------------------------------------------------------
// Scroll adapter factory
// ---------------------------------------------------------------------------

/**
 * Build a `PreviewScrollAdapter` that maps source lines to Marp slides.
 *
 * `getLineRanges` reads from the cached `marpResult.latest` so there is no
 * re-parsing on every scroll event — line ranges are computed once per content
 * change alongside the render.
 */
function createSlideAdapter(
  getLineRanges: () => SlideLineRange[],
  getShadowHost: () => HTMLElement | undefined,
): PreviewScrollAdapter {
  function getSvgs(): HTMLElement[] {
    const host = getShadowHost();
    if (!host?.shadowRoot) return [];
    return [...host.shadowRoot.querySelectorAll<HTMLElement>("[data-marpit-svg]")];
  }

  return {
    syncFromEditorLine(line: number) {
      const host = getShadowHost();
      if (!host) return;

      const svgs = getSvgs();
      if (svgs.length === 0) return;

      const idx = Math.min(slideIndexForLine(getLineRanges(), line), svgs.length - 1);
      const svg = svgs[idx];
      if (!svg) return;

      const hostRect = host.getBoundingClientRect();
      const svgRect = svg.getBoundingClientRect();
      const targetScrollTop = svgRect.top - hostRect.top + host.scrollTop;

      if (Math.abs(host.scrollTop - targetScrollTop) < 1) return;
      host.scrollTop = targetScrollTop;
    },

    getTopSourceLine() {
      const host = getShadowHost();
      if (!host) return 1;

      const svgs = getSvgs();
      if (svgs.length === 0) return 1;

      const hostRect = host.getBoundingClientRect();

      // Find the last SVG whose top edge has scrolled at or above the viewport.
      let visibleIdx = 0;
      for (let i = 0; i < svgs.length; i++) {
        const svgTop = svgs[i].getBoundingClientRect().top - hostRect.top;
        if (svgTop <= 1) {
          visibleIdx = i;
        } else {
          break;
        }
      }

      return getLineRanges()[visibleIdx]?.start ?? 1;
    },

    subscribeScroll(handler: () => void) {
      const host = getShadowHost();
      if (!host) return () => {};
      host.addEventListener("scroll", handler, { passive: true });
      return () => host.removeEventListener("scroll", handler);
    },
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SlideRendererProps {
  content: string;
  /** Called with the scroll adapter once the shadow DOM is ready (null on unmount). */
  onAdapterReady?: (adapter: PreviewScrollAdapter | null) => void;
}

const SlideRenderer: Component<SlideRendererProps> = (props) => {
  // Callback ref — explicit assignment that satisfies the linter.
  let shadowHostRef: HTMLDivElement | undefined;
  const [shadowRoot, setShadowRoot] = createSignal<ShadowRoot | undefined>();

  // Render Marp content (and compute line ranges) whenever content changes.
  const [marpResult] = createResource(() => props.content, renderWithMarp);

  // Create the shadow root once on mount and expose the scroll adapter.
  onMount(() => {
    if (!shadowHostRef) return;
    const root = shadowHostRef.attachShadow({ mode: "open" });
    setShadowRoot(root);

    props.onAdapterReady?.(
      createSlideAdapter(
        // marpResult.latest is always the most recently resolved value —
        // reading it synchronously inside scroll callbacks is safe and avoids
        // re-parsing the document on every scroll event.
        () => marpResult.latest?.lineRanges ?? [],
        () => shadowHostRef,
      ),
    );
  });

  // Re-render shadow DOM content whenever the Marp result is updated.
  createEffect(() => {
    const root = shadowRoot();
    const result = marpResult.latest;
    if (!root || !result) return;

    root.innerHTML = `<style>${SHADOW_BASE_STYLE}${result.css}</style>${result.html}`;
  });

  // ── Export helpers ─────────────────────────────────────────────────────────

  const handleExportHtml = async () => {
    const html = await buildMarpHtml(props.content);
    downloadHtml(html, "slides.html");
  };

  const handlePrint = async () => {
    // Inject an auto-print script and open via blob URL.
    const base = await buildMarpHtml(props.content);
    const printHtml = base.replace(
      "</body>",
      "<script>window.addEventListener('load',()=>window.print());</script></body>",
    );
    const url = URL.createObjectURL(new Blob([printHtml], { type: "text/html;charset=utf-8" }));
    const win = window.open(url, "_blank");
    if (!win) {
      URL.revokeObjectURL(url);
      return;
    }
    win.addEventListener("afterprint", () => URL.revokeObjectURL(url));
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div class="bg-surface-primary flex h-full w-full flex-col">
      {/* Toolbar */}
      <div class="border-border-primary flex shrink-0 items-center justify-end gap-1 border-b px-2 py-1">
        <button
          type="button"
          class="button flex items-center gap-1 px-2 py-1 text-xs"
          onClick={handleExportHtml}
          title="Export as HTML file"
        >
          <span class="i-material-symbols:download size-4 shrink-0" />
          Export HTML
        </button>
        <button
          type="button"
          class="button flex items-center gap-1 px-2 py-1 text-xs"
          onClick={handlePrint}
          title="Open print dialog (save as PDF)"
        >
          <span class="i-material-symbols:print size-4 shrink-0" />
          Print / PDF
        </button>
      </div>

      {/* Shadow host — scrolling container for slides */}
      <div
        ref={(el) => {
          shadowHostRef = el;
        }}
        class="min-h-0 flex-1 overflow-auto"
        aria-label="Slide preview"
      />
    </div>
  );
};

export default SlideRenderer;
